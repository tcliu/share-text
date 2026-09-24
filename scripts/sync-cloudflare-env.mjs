#!/usr/bin/env node
// Syncs `.env.prod` overlaid by `.env.cloudflare` to the Cloudflare Pages
// project (CLOUDFLARE_PROJECT owns the project name; the live URL is the
// Pages production domain derived from it, never an overlay key).
// Generates the gitignored root `wrangler.toml` (name + static Pages
// stanza + `[vars]`) that `wrangler pages deploy` auto-discovers, and pushes
// secrets via `wrangler pages secret put` (value on stdin, never argv).
//
// `wrangler pages deploy` treats `[vars]` as the complete managed plain-var
// set: a config-managed plain var absent from it is DELETED from the project.
// The sync therefore always writes the full desired set — an early version
// wrote only the drifted subset and wiped every plain var, because the deploy
// replaces rather than merges. The remote read still reports
// missing/changed/unchanged and drives `--prune`:
//   * vars    — report drift, then write every desired var.
//   * secrets — put only with `--secrets=missing`, which skips the names
//               already present. Cloudflare never returns secret values, so an
//               updated value is undetectable; the default `always` re-puts
//               every secret so rotations always land.
//   * `--prune` removes remote secrets absent from the .env files,
//               mirroring `sync-vercel-env.mjs --prune`.
//   * forbidden keys are always removed, per backend: a D1-backed app forbids
//               the Neon URL (a synced Neon URL silently wins over the D1
//               binding) and Vercel creds; a Neon-backed app forbids only
//               Vercel creds, since the Neon URL is its backend.
// `--dry-run` reports the plan without writing. Empty local values are skipped
// (the remote value survives); local-only keys are never synced.
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnvFile } from './env-file.mjs'
import { logEvent } from './log-event.mjs'
import {
  CLOUDFLARE_LOCAL_ONLY_KEYS,
  cloudflareForbiddenKeys,
  desiredPagesVars,
  ensurePagesProject,
  GENERATED_WRANGLER_CONFIG,
  generatedWranglerProjectName,
  renderWranglerConfig,
  resolveD1DatabaseName,
  splitCloudflareEnv,
  wranglerBin,
} from './lib/cloudflare.mjs'
import {
  diffDesiredSecrets,
  diffDesiredVars,
  fetchPagesEnvState,
  findOrphanKeys,
  patchPagesEnvVars,
} from './lib/cloudflare-pages-env.mjs'
import { runWithConcurrency } from './lib/concurrency.mjs'
import { loadTargetEnv, loadTargetFileEnv } from './lib/target-env.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPT_DIR, '..')
// Shared prod values (.env.prod) overlaid by Cloudflare-only values
// (.env.cloudflare); the overlay wins on conflict. Files-only merge: shell
// never invents synced keys (see loadTargetFileEnv).
const SOURCE_FILES = ['.env.prod', '.env.cloudflare']
const GENERATED_FILE = join(ROOT_DIR, GENERATED_WRANGLER_CONFIG)
const SECRET_CONCURRENCY = 4
const SECRET_MODES = ['always', 'missing']

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseFlags(argv) {
  const dryRun = argv.includes('--dry-run')
  const prune = argv.includes('--prune')
  const secretFlags = argv.filter(arg => arg.startsWith('--secrets='))
  const unknown = argv.filter(
    arg => arg !== '--dry-run' && arg !== '--prune' && !arg.startsWith('--secrets='),
  )
  if (unknown.length > 0) {
    fail(`Unknown option: ${unknown.join(', ')} (expected --dry-run, --prune, --secrets=always|missing).`)
  }
  // A repeated flag with conflicting values is a mistake, not last-wins.
  const modes = new Set(secretFlags.map(arg => arg.slice('--secrets='.length)))
  if (modes.size > 1) {
    fail(`Conflicting --secrets values: ${[...modes].join(', ')}.`)
  }
  const secrets = secretFlags.length > 0 ? secretFlags[0].slice('--secrets='.length) : 'always'
  if (!SECRET_MODES.includes(secrets)) {
    fail(`Unknown --secrets mode: ${secrets} (expected ${SECRET_MODES.join('|')}).`)
  }
  return { dryRun, prune, secrets }
}

function runWranglerAsync(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const bin = wranglerBin()
    const fullArgs = bin === 'npx' ? ['wrangler', ...args] : args
    // No command echo here: the only caller passes the secret on stdin, and
    // per-key completion events below carry the progress signal instead.
    const child = spawn(bin, fullArgs, { cwd: ROOT_DIR, stdio: ['pipe', 'inherit', 'inherit'] })
    const stdin = child.stdin
    stdin.on('error', () => {
      // The child can exit before draining stdin (EPIPE on early failure);
      // the close handler below reports the real exit status.
    })
    stdin.end(input)
    child.on('error', reject)
    child.on('close', code => {
      if ((code ?? 1) === 0) {
        resolve()
      } else {
        reject(new Error(`wrangler ${fullArgs.join(' ')} failed (exit ${code ?? 1}).`))
      }
    })
  })
}

async function putSecret(project, key, value) {
  await runWranglerAsync(['pages', 'secret', 'put', key, '--project', project], { input: value })
  logEvent({ action: 'cloudflare_env_secret_synced', details: { key } })
}

async function main() {
  const startedAt = Date.now()
  const { dryRun, prune, secrets: secretsMode } = parseFlags(process.argv.slice(2))
  const missing = SOURCE_FILES.filter(file => !existsSync(join(ROOT_DIR, file)))
  if (missing.length > 0) {
    fail(`Missing ${missing.join(', ')}: shared prod values live in .env.prod, Cloudflare-only values in .env.cloudflare.`)
  }
  // Files-only merge for the key universe (shell never invents synced keys);
  // shell still seeds auth below via process.env.
  const raw = loadTargetFileEnv('cloudflare', ROOT_DIR)
  // Wrangler authenticates from the process env; the operator token lives in
  // `.env.local` (never synced — outside the file universe above). Seed it so
  // `secret put` and the remote read work standalone; shell always wins.
  const local = parseEnvFile(join(ROOT_DIR, '.env.local'))
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
    if (!process.env[key] && String(local[key] || '').trim()) {
      process.env[key] = String(local[key]).trim()
    }
  }
  // Isolation policy follows the backend, matching the deploy flow: a D1-backed
  // target forbids the Neon URL (it would silently win over the binding); a
  // Neon-backed target keeps DATABASE_URL in sync and forbids only Vercel
  // creds. Detection uses the shell-aware merge so a shell override agrees with
  // what the deploy sees.
  const d1Mode = resolveD1DatabaseName(loadTargetEnv('cloudflare', ROOT_DIR)) !== ''
  const forbiddenKeys = cloudflareForbiddenKeys(d1Mode)
  // Split shared with deploy.mjs (splitCloudflareEnv): local-only keys log as
  // skipped, empty values keep the remote value, secrets go to the store.
  const { project: overlayProject, vars, secrets } = splitCloudflareEnv(raw, { forbidden: forbiddenKeys })
  for (const key of Object.keys(raw)) {
    if (CLOUDFLARE_LOCAL_ONLY_KEYS.has(key)) {
      logEvent({ action: 'cloudflare_env_local_skip', details: { key } })
    } else if (!raw[key]) {
      logEvent({ action: 'cloudflare_env_empty_skip', details: { key } })
    }
  }
  const project = overlayProject || generatedWranglerProjectName(ROOT_DIR)
  if (!project) {
    fail('Missing CLOUDFLARE_PROJECT in .env.cloudflare: set it to the Pages project name.')
  }
  logEvent({ action: 'cloudflare_env_sync_start', details: { project, dry_run: dryRun, secrets_mode: secretsMode } })

  // The desired set always carries the forced build vars, matching what
  // renderWranglerConfig would emit for a full write.
  const desiredVars = desiredPagesVars(vars)
  const desiredKeys = [...Object.keys(desiredVars), ...Object.keys(secrets)]

  // Remote state drives the missing/updated skip and --prune. A failed read
  // degrades vars to a full write; `--secrets=missing` cannot be honored
  // without it, so it fails loudly rather than silently overwriting.
  let remote = null
  try {
    remote = await fetchPagesEnvState({
      project,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    })
  } catch (error) {
    if (secretsMode === 'missing') {
      fail(`Cannot use --secrets=missing without remote env vars: ${error?.message || error}`)
    }
    logEvent({
      action: 'cloudflare_env_read_fallback',
      details: { error: error?.message || error, level: 'WARN' },
    })
  }

  const varDiff = remote
    ? diffDesiredVars(desiredVars, remote.envVars)
    : { missing: Object.keys(desiredVars), changed: [], unchanged: [], drift: Object.keys(desiredVars) }
  const secretDiff = remote
    ? diffDesiredSecrets(secrets, remote.envVars)
    : { missing: Object.keys(secrets), present: [] }
  if (remote) {
    const drifted = varDiff.drift
    logEvent({
      action: 'cloudflare_env_drift',
      details: {
        vars_missing: varDiff.missing.length,
        vars_changed: varDiff.changed.length,
        vars_unchanged: varDiff.unchanged.length,
        drifted,
        secrets_missing: secretDiff.missing.length,
        secrets_present: secretDiff.present.length,
      },
    })
  }

  // Always write the full desired set: the deploy replaces the managed plain
  // vars with exactly `[vars]`, so omitting unchanged keys deletes them. Drift
  // is reported above but never used to shrink the written set.
  const varsToWrite = { ...desiredVars }
  if (dryRun) {
    for (const key of Object.keys(varsToWrite)) {
      logEvent({ action: 'cloudflare_env_var_synced', details: { key, dry_run: true } })
    }
  } else {
    writeFileSync(GENERATED_FILE, renderWranglerConfig({ project, vars: varsToWrite }))
    for (const key of Object.keys(varsToWrite)) {
      logEvent({ action: 'cloudflare_env_var_synced', details: { key } })
    }
  }

  // Secrets: `always` re-puts every secret so a rotated value lands; `missing`
  // skips the names already present (values are write-only, so only existence
  // can be compared).
  const secretsToPut = secretsMode === 'missing' ? secretDiff.missing : Object.keys(secrets)
  for (const key of secretDiff.present) {
    if (!secretsToPut.includes(key)) {
      logEvent({ action: 'cloudflare_env_secret_kept', details: { key } })
    }
  }
  if (!dryRun && secretsToPut.length > 0 && process.env.PAGES_PROJECT_ASSURED !== '1') {
    // Secrets need the Pages project to exist; first sync creates it. The
    // deploy flow assures the project in its auth step and passes
    // PAGES_PROJECT_ASSURED=1, skipping this second listing.
    ensurePagesProject(project)
  }
  const pendingSecrets = secretsToPut.map(key => [key, secrets[key]])
  if (dryRun) {
    for (const [key] of pendingSecrets) {
      logEvent({ action: 'cloudflare_env_secret_synced', details: { key, dry_run: true } })
    }
  } else {
    await runWithConcurrency(
      pendingSecrets.map(
        ([key, value]) =>
          async () => {
            await putSecret(project, key, value)
            return key
          },
      ),
      SECRET_CONCURRENCY,
    )
  }

  // Forbidden keys for this backend must never exist on the Pages project.
  // Remove them unconditionally, unlike the opt-in --prune below.
  const forbidden = remote ? Object.keys(remote.envVars).filter(key => forbiddenKeys.has(key)) : []
  // Prune: remote secrets no longer in the .env universe (opt-in, like the
  // Vercel sync). Forbidden keys are excluded here — they are always removed.
  const unmanaged = remote
    ? findOrphanKeys(remote.envVars, desiredKeys).filter(
        key => remote.envVars[key]?.type !== 'plain_text' && !forbiddenKeys.has(key),
      )
    : []
  if (forbidden.length > 0) {
    logEvent({ action: 'cloudflare_env_forbidden_remove', details: { keys: forbidden, dry_run: dryRun } })
  }
  if (unmanaged.length > 0 && !prune) {
    logEvent({ action: 'cloudflare_env_prune_skip', details: { keys: unmanaged, hint: 're-run with --prune to remove them' } })
  }
  // One PATCH carries both deletions so the config hash is read once and the
  // forbidden-key removal cannot race the prune's stale hash.
  const toDelete = [...new Set([...forbidden, ...(prune ? unmanaged : [])])]
  if (toDelete.length > 0) {
    if (!dryRun) {
      await patchPagesEnvVars({
        project,
        envVars: Object.fromEntries(toDelete.map(key => [key, null])),
        configHash: remote.configHash,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        token: process.env.CLOUDFLARE_API_TOKEN,
      })
    }
    for (const key of forbidden) {
      logEvent({ action: 'cloudflare_env_forbidden_removed', details: { key, dry_run: dryRun } })
    }
    for (const key of unmanaged) {
      if (prune) {
        logEvent({ action: 'cloudflare_env_pruned', details: { key, dry_run: dryRun } })
      }
    }
  }

  logEvent({
    action: 'cloudflare_env_sync_end',
    details: {
      project,
      vars: Object.keys(varsToWrite).length,
      secrets_put: secretsToPut.length,
      secrets_total: Object.keys(secrets).length,
      dry_run: dryRun,
      elapsed_ms: Date.now() - startedAt,
    },
  })
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
