#!/usr/bin/env node
// Syncs `.env.prod` overlaid by `.env.cloudflare` to the Cloudflare Worker
// (CLOUDFLARE_PROJECT owns the Worker name; the live URL is the Worker's
// Workers.dev host derived from it, never an overlay key).
// Generates the gitignored root `wrangler.toml` (name + Workers stanza +
// `[vars]`) that `wrangler deploy` auto-discovers, and pushes secrets via
// `wrangler secret put` (value on stdin, never argv).
//
// `wrangler deploy` replaces every plain var with the generated `[vars]`: a
// var absent from it is DELETED from the Worker. The sync therefore always
// writes the full desired set — writing only the drifted subset would wipe
// every plain var, because the deploy replaces rather than merges. Secrets are
// never deleted by a deployment, so they are diffed and pruned explicitly:
//   * vars    — write every desired var; drift is not used to shrink the set.
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
// A Worker that has never been deployed has no secret store yet: the sync
// defers secret writes (and deletion) to the deploy, which uploads them with
// `--secrets-file` on the same run.
// `--dry-run` reports the plan without writing. Empty local values are skipped
// (the remote value survives); local-only keys are never synced.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnvFile } from './env-file.mjs'
import { parseFlags } from './lib/cloudflare-env-flags.mjs'
import { logEvent } from './log-event.mjs'
import { echoCommand } from './_run.mjs'
import { failExit } from './_deploy/core.mjs'
import { ROOT as ROOT_DIR } from './lib/root.mjs'
import { resolveDeployBackend } from './_deploy/backend.mjs'
import {
  CLOUDFLARE_LOCAL_ONLY_KEYS,
  cloudflareForbiddenKeys,
  desiredWorkerVars,
  GENERATED_WRANGLER_CONFIG,
  generatedWranglerProjectName,
  renderWranglerConfig,
  splitCloudflareEnv,
  wranglerArgs,
  wranglerBin,
} from './lib/cloudflare.mjs'
import {
  diffDesiredSecrets,
  findOrphanSecrets,
  readWorkerSecretNames,
} from './lib/cloudflare-worker-env.mjs'
import { runWithConcurrency } from './lib/concurrency.mjs'
import {
  loadTargetFileEnv,
  missingTargetSources,
  seedCloudflareCredentials,
  targetSourceFiles,
} from './lib/target-env.mjs'

// Shared prod values (.env.prod) overlaid by Cloudflare-only values
// (.env.cloudflare); the overlay wins on conflict. Files-only merge: shell
// never invents synced keys (see loadTargetFileEnv).
const SOURCE_FILES = targetSourceFiles('cloudflare')
const GENERATED_FILE = join(ROOT_DIR, GENERATED_WRANGLER_CONFIG)
const SECRET_CONCURRENCY = 4

function runWranglerAsync(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const bin = wranglerBin()
    const fullArgs = wranglerArgs(args, bin)
    // The secret value goes on stdin, never argv, so the echoed command is
    // safe; per-key completion events below carry the progress signal.
    echoCommand(bin, fullArgs)
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

async function putSecret(worker, key, value) {
  await runWranglerAsync(['secret', 'put', key, '--name', worker], { input: value })
  logEvent({ action: 'cloudflare_env_secret_synced', details: { key } })
}

async function deleteSecret(worker, key) {
  await runWranglerAsync(['secret', 'delete', key, '--name', worker])
}

async function main() {
  const startedAt = Date.now()
  const { dryRun, prune, secrets: secretsMode } = parseFlags(process.argv.slice(2))
  const missing = missingTargetSources('cloudflare', ROOT_DIR)
  if (missing.length > 0) {
    failExit(
      `Missing ${missing.join(', ')}: shared prod values live in .env.prod, Cloudflare-only values in .env.cloudflare.`,
    )
  }
  // Files-only merge for the key universe (shell never invents synced keys);
  // shell still seeds auth below via process.env.
  const raw = loadTargetFileEnv('cloudflare', ROOT_DIR)
  // Wrangler authenticates from the process env; the operator token lives in
  // `.env.local`/shell only, while the account id may also come from the synced
  // overlay — the same layers the deploy target and preflight accept. Seed both
  // so `secret put` and the remote read work standalone; shell always wins.
  const local = parseEnvFile(join(ROOT_DIR, '.env.local'))
  const accountIdEnv = { ...raw, ...local }
  seedCloudflareCredentials({ token: local, accountId: accountIdEnv })
  // Isolation policy follows the resolved backend, matching the deploy flow: a
  // D1-backed target forbids the Neon URL (it would silently win over the
  // binding); a Neon-backed target keeps DATABASE_URL in sync and forbids only
  // Vercel creds. Detection uses the shared resolver over the same files-only
  // push universe the deploy reads, so both agree.
  const backend = resolveDeployBackend('cloudflare', raw)
  const forbiddenKeys = cloudflareForbiddenKeys(backend === 'd1')
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
  const worker = overlayProject || generatedWranglerProjectName(ROOT_DIR)
  if (!worker) {
    failExit('Missing CLOUDFLARE_PROJECT in .env.cloudflare: set it to the Worker name.')
  }
  logEvent({ action: 'cloudflare_env_sync_start', details: { project: worker, dry_run: dryRun, secrets_mode: secretsMode } })

  // The desired set always carries the forced build vars, matching what
  // renderWranglerConfig emits for a full write.
  const desiredVars = desiredWorkerVars(vars)
  const desiredKeys = [...Object.keys(desiredVars), ...Object.keys(secrets)]

  // Remote secret names drive the missing/updated skip and --prune. A Worker
  // without a deployment has no secret store yet, so the read yields null and
  // the deploy uploads the secrets with `--secrets-file`; `--secrets=missing`
  // cannot be honored there, so it fails loudly rather than guessing.
  const remoteSecretNames = readWorkerSecretNames({ worker, cwd: ROOT_DIR })
  if (remoteSecretNames === null && secretsMode === 'missing') {
    failExit(
      `Cannot use --secrets=missing before the Worker ${worker} exists: deploy it first or use --secrets=always.`,
    )
  }
  const secretDiff = remoteSecretNames
    ? diffDesiredSecrets(secrets, remoteSecretNames)
    : { missing: Object.keys(secrets), present: [] }
  logEvent({
    action: 'cloudflare_env_drift',
    details: {
      vars: Object.keys(desiredVars).length,
      secrets_missing: secretDiff.missing.length,
      secrets_present: secretDiff.present.length,
      remote_known: remoteSecretNames !== null,
    },
  })

  // Always write the full desired set: the deploy replaces the Worker's plain
  // vars with exactly `[vars]`, so omitting unchanged keys deletes them.
  if (dryRun) {
    for (const key of Object.keys(desiredVars)) {
      logEvent({ action: 'cloudflare_env_var_synced', details: { key, dry_run: true } })
    }
  } else {
    writeFileSync(GENERATED_FILE, renderWranglerConfig({ project: worker, vars: desiredVars }))
    for (const key of Object.keys(desiredVars)) {
      logEvent({ action: 'cloudflare_env_var_synced', details: { key } })
    }
  }

  // Secrets: `always` re-puts every secret so a rotated value lands; `missing`
  // skips the names already present (values are write-only, so only existence
  // can be compared). A Worker that has never been deployed defers to the
  // deploy's `--secrets-file` upload.
  const secretsToPut =
    remoteSecretNames === null
      ? []
      : secretsMode === 'missing'
        ? secretDiff.missing
        : Object.keys(secrets)
  if (remoteSecretNames === null) {
    logEvent({
      action: 'cloudflare_env_secrets_deferred',
      details: { keys: Object.keys(secrets), hint: 'the deploy uploads them with --secrets-file' },
    })
  }
  for (const key of secretDiff.present) {
    if (!secretsToPut.includes(key)) {
      logEvent({ action: 'cloudflare_env_secret_kept', details: { key } })
    }
  }
  const pendingSecrets = secretsToPut.map(key => [key, secrets[key]])
  if (dryRun) {
    for (const [key] of pendingSecrets) {
      logEvent({ action: 'cloudflare_env_secret_synced', details: { key, dry_run: true } })
    }
  } else if (pendingSecrets.length > 0) {
    await runWithConcurrency(
      pendingSecrets.map(([key, value]) => async () => {
        await putSecret(worker, key, value)
        return key
      }),
      SECRET_CONCURRENCY,
    )
  }

  // Forbidden keys for this backend must never exist on the Worker. Remove the
  // secret ones unconditionally (plain vars are dropped by the deploy's
  // `[vars]` replacement), unlike the opt-in --prune below.
  const forbidden =
    remoteSecretNames === null ? [] : remoteSecretNames.filter(key => forbiddenKeys.has(key))
  // Prune: remote secrets no longer in the .env universe (opt-in, like the
  // Vercel sync). Forbidden keys are excluded here — they are always removed.
  const unmanaged =
    remoteSecretNames === null
      ? []
      : findOrphanSecrets(remoteSecretNames, desiredKeys).filter(key => !forbiddenKeys.has(key))
  if (forbidden.length > 0) {
    logEvent({ action: 'cloudflare_env_forbidden_remove', details: { keys: forbidden, dry_run: dryRun } })
  }
  if (unmanaged.length > 0 && !prune) {
    logEvent({
      action: 'cloudflare_env_prune_skip',
      details: { keys: unmanaged, hint: 're-run with --prune to remove them' },
    })
  }
  const toDelete = [...new Set([...forbidden, ...(prune ? unmanaged : [])])]
  if (toDelete.length > 0) {
    if (!dryRun) {
      await runWithConcurrency(
        toDelete.map(key => async () => {
          await deleteSecret(worker, key)
          return key
        }),
        SECRET_CONCURRENCY,
      )
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
      project: worker,
      vars: Object.keys(desiredVars).length,
      secrets_put: secretsToPut.length,
      secrets_total: Object.keys(secrets).length,
      dry_run: dryRun,
      elapsed_ms: Date.now() - startedAt,
    },
  })
}

// Run only as a CLI, so importing `parseFlags` from tests does not start a sync.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error?.message || error)
    process.exit(1)
  })
}
