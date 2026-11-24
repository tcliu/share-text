#!/usr/bin/env node
// _deploy/targets/cloudflare.mjs — Cloudflare Workers deploy target: auth
// check, env sync, D1 provisioning/binding, isolation gate, build, and
// `wrangler deploy`. Built on the shared deploy core (`../core.mjs`) and lib/.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { logEvent } from '../../log-event.mjs'
import { formatCommand } from '../../_run.mjs'
import { assembleSteps, pluginSteps, ROOT_DIR, formatElapsedTime, runScript, runSteps } from '../core.mjs'
import {
  cloudflareForbiddenKeys,
  fetchWorkersSubdomain,
  GENERATED_WRANGLER_CONFIG,
  desiredWorkerVars,
  ensureD1Database,
  generatedWranglerProjectName,
  listWorkerScripts,
  renderWranglerConfig,
  resolveCloudflareProjectName,
  resolveD1DatabaseName,
  splitCloudflareEnv,
  workersHost,
  wranglerArgs,
  wranglerBin,
} from '../../lib/cloudflare.mjs'
import { diffDesiredSecrets, readWorkerSecretNames } from '../../lib/cloudflare-worker-env.mjs'
import {
  loadTargetEnv,
  loadTargetFileEnv,
  loadTargetOperatorEnv,
  seedCloudflareCredentials,
} from '../../lib/target-env.mjs'
import { D1_BINDING_NAME } from '../../../src/lib/server/d1-binding.mjs'

// Cloudflare Workers target. Reads `.env.prod` overlaid by `.env.cloudflare`
// (never `.env.vercel`), so the two targets keep independent URLs; the Neon
// schema step is shared (see the deploy flow). Load order matches
// loadTargetEnv: `.env` < `.env.local` < `.env.prod` < overlay < shell.
function cloudflareEnv() {
  return loadTargetEnv('cloudflare', ROOT_DIR)
}

// Worker secrets for this backend: the same split the env sync pushes, with the
// forbidden keys dropped so a stale Neon URL or Vercel credential can never be
// uploaded by the deploy.
function pushSecrets(d1Mode) {
  return splitCloudflareEnv(loadTargetFileEnv('cloudflare', ROOT_DIR), {
    forbidden: cloudflareForbiddenKeys(d1Mode),
  }).secrets
}

function cloudflareProjectName() {
  // Overlay owns the name (mirrors VERCEL_PROJECT); the generated config is
  // the fallback so a checkout that predates the key keeps working.
  const name = resolveCloudflareProjectName(cloudflareEnv(), generatedWranglerProjectName(ROOT_DIR))
  if (!name) {
    throw new Error('Missing CLOUDFLARE_PROJECT in .env.cloudflare: set it to the Worker name.')
  }
  return name
}

function seedWranglerToken() {
  // Wrangler authenticates from the process env. The operator token lives in
  // `.env.local`/shell only (never synced); the account id may come from either
  // the operator layer or the synced `.env.cloudflare`, matching the preflight.
  // Seed both so `wrangler` children see them; shell values always win.
  const operator = loadTargetOperatorEnv(ROOT_DIR)
  // Match the preflight's accepted layers for the account id exactly: the
  // synced push universe plus the operator layer (never `.env`).
  const accountIdEnv = { ...loadTargetFileEnv('cloudflare', ROOT_DIR), ...operator }
  seedCloudflareCredentials({ token: operator, accountId: accountIdEnv })
}

// Regenerates the gitignored root `wrangler.toml` from the overlay
// (idempotent, so both the auth step and env-sync can call it): `--no-sync-env`
// runs still get a complete config for `wrangler deploy`. Split shared with
// sync-cloudflare-env.mjs so vars/secrets/local-only handling cannot drift.
function ensureGeneratedConfig(d1 = null) {
  const { vars } = splitCloudflareEnv(loadTargetFileEnv('cloudflare', ROOT_DIR))
  const project = cloudflareProjectName()
  writeFileSync(
    join(ROOT_DIR, GENERATED_WRANGLER_CONFIG),
    renderWranglerConfig({ project, vars: desiredWorkerVars(vars), d1 }),
  )
  return project
}

// Auth check before any build/deploy CLI: listing the account's Workers proves
// the token and account id resolve. It needs Workers Scripts:Read, the same
// scope `wrangler deploy` uses.
async function ensureCloudflareAccess() {
  seedWranglerToken()
  const project = cloudflareProjectName()
  const hasToken = Boolean(String(process.env.CLOUDFLARE_API_TOKEN || '').trim())
  const hasAccountId = Boolean(String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim())
  const context = `worker "${project}", wrangler bin "${wranglerBin()}", token ${hasToken ? 'present' : 'missing'}, account ${hasAccountId ? 'present' : 'missing'}`
  try {
    await listWorkerScripts({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    })
  } catch (error) {
    throw new Error(
      `Cloudflare Workers access check failed (${context}): ${error?.message || error} ` +
        'Set CLOUDFLARE_API_TOKEN (Workers Scripts:Edit) and CLOUDFLARE_ACCOUNT_ID in shell or .env.local and retry the deploy.',
    )
  }
}

// Workers.dev hostname for the Worker; '' when the API cannot resolve it (the
// deploy output still carries the URL). Never fatal: a first deploy has no
// script yet, but the account subdomain usually resolves.
async function resolveDeployHost(project) {
  try {
    const subdomain = await fetchWorkersSubdomain({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    })
    return workersHost(project, subdomain)
  } catch (error) {
    logEvent({
      action: 'cloudflare_subdomain_warn',
      details: { worker: project, error: error?.message || error, level: 'WARN' },
    })
    return ''
  }
}

function runCloudflareBuild() {
  console.log(`${formatCommand('npm', ['run', 'build'])} (CF_WORKERS=1)`)
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, CF_WORKERS: '1' },
  })
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Cloudflare build failed (exit ${result.status ?? 1}).`)
  }
}

// Secrets file for `wrangler deploy --secrets-file`: JSON so values are never
// dotenv-expanded, written under the gitignored `.wrangler/` directory with an
// owner-only mode and removed after the deploy.
function writeSecretsFile(secrets) {
  if (Object.keys(secrets).length === 0) {
    return ''
  }
  const dir = join(ROOT_DIR, '.wrangler')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'secrets.json')
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 })
  chmodSync(file, 0o600)
  return file
}

function runCloudflareDeploy(secrets = {}) {
  const project = cloudflareProjectName()
  const bin = wranglerBin()
  const secretsFile = writeSecretsFile(secrets)
  // No `--config`: `wrangler deploy` auto-discovers the generated root config
  // and follows `.wrangler/deploy/config.json` to the adapter output. The
  // `--secrets-file` upload is additive, so a first deploy starts with its
  // runtime secrets already in place instead of needing a second deploy.
  const args = ['deploy']
  if (secretsFile) {
    args.push('--secrets-file', secretsFile)
  }
  const fullArgs = wranglerArgs(args, bin)
  console.log(formatCommand(bin, fullArgs))
  let result
  try {
    result = spawnSync(bin, fullArgs, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    })
  } finally {
    if (secretsFile) {
      rmSync(secretsFile, { force: true })
    }
  }
  const output = `${result?.stdout ?? ''}${result?.stderr ?? ''}`
  process.stderr.write(output)
  if ((result?.status ?? 1) !== 0) {
    throw new Error(`wrangler deploy failed (exit ${result?.status ?? 1}).`)
  }
  const match = /https:\/\/[^\s"']+\.workers\.dev/.exec(output)
  return match ? match[0] : ''
}

// Hard isolation gate: forbidden secrets on the Worker are a fatal
// misconfiguration (in D1 mode a remote Neon URL silently wins over the D1
// binding; anywhere, Vercel credentials re-couple the target). Plain vars need
// no check — `wrangler deploy` replaces them with the generated `[vars]`. The
// env sync removes forbidden secrets; this re-reads to prove it and aborts
// before build/deploy when one survives. A failed read is only a warning.
async function assertCloudflareIsolation(forbidden) {
  const secretNames = readWorkerSecretNames({ worker: cloudflareProjectName(), cwd: ROOT_DIR })
  if (secretNames === null) {
    logEvent({ action: 'cloudflare_isolation_skip', details: { level: 'WARN' } })
    return
  }
  const found = secretNames.filter(key => forbidden.has(key))
  if (found.length > 0) {
    throw new Error(
      `Cloudflare Worker still carries forbidden secret(s): ${found.join(', ')}. ` +
        'Re-run `npm run env:sync:cloudflare -- --prune` and retry.',
    )
  }
}

// Post-deploy safety net: `wrangler deploy --secrets-file` uploads the desired
// secrets additively, so a missing name means the upload dropped something.
// Re-read the deployed secret names and warn on any desired key that is
// missing; never fails the deploy.
async function verifyCloudflareSecrets(d1Mode) {
  const secretNames = readWorkerSecretNames({ worker: cloudflareProjectName(), cwd: ROOT_DIR })
  if (secretNames === null) {
    logEvent({ action: 'cloudflare_verify_skip', details: { error: 'secret list unavailable', level: 'WARN' } })
    return
  }
  const { missing } = diffDesiredSecrets(pushSecrets(d1Mode), secretNames)
  if (missing.length > 0) {
    console.error(
      `-> WARNING: Cloudflare Worker is missing ${missing.length} desired secret(s) (${missing.join(', ')}). ` +
        'Re-run the Cloudflare deploy to re-apply the secrets file.',
    )
  }
}

// Intrinsic Cloudflare steps: the capabilities the CF target always runs
// (auth/access, isolation gate, D1 provisioning, schema apply, build, ship).
// Cross-cutting capabilities are appended by the plugin pipeline.
function cloudflareSteps(ctx) {
  const { applySchema, backend = 'neon', state } = ctx
  const d1Mode = backend === 'd1'
  // The auth step resolves the live URL from the Worker (below); no
  // APP_BASE_URL exists on this target.
  return [
    {
      name: 'auth',
      phase: 'setup',
      run: async () => {
        // Generate first: the deploy needs the config at its standard root
        // path; this also makes --no-sync-env work on a fresh checkout.
        ensureGeneratedConfig()
        await ensureCloudflareAccess()
        const project = cloudflareProjectName()
        const host = await resolveDeployHost(project)
        if (host) {
          state.productionHost = host
          state.appUrl = `https://${host}`
        } else {
          logEvent({ action: 'cloudflare_production_host_unresolved', details: { worker: project, level: 'WARN' } })
        }
      },
    },
    {
      name: 'isolation',
      phase: 'isolation',
      run: async () => {
        // Runs regardless of --sync-env: a surviving forbidden secret would
        // silently re-couple the target (Neon URL over D1 in D1 mode, Vercel
        // credentials anywhere).
        await assertCloudflareIsolation(cloudflareForbiddenKeys(d1Mode))
      },
    },
    {
      name: 'd1',
      phase: 'provision',
      run: () => {
        if (!d1Mode) {
          logEvent({ action: 'cloudflare_neon_backend' })
          return
        }
        const databaseName = resolveD1DatabaseName(cloudflareEnv())
        const { status, databaseId } = ensureD1Database(databaseName)
        state.d1 = { binding: D1_BINDING_NAME, databaseName, databaseId }
        logEvent({
          action: status === 'created' ? 'd1_database_created' : 'd1_database_ready',
          details: { databaseName, databaseId },
        })
        // Regenerate the config with the binding: the env sync writes it without
        // one, and `wrangler deploy` reads the config at deploy time.
        ensureGeneratedConfig(state.d1)
      },
    },
    {
      name: 'schema',
      phase: 'schema',
      run: () => {
        if (d1Mode) {
          if (applySchema !== 'yes') {
            logEvent({ action: 'd1_schema_skip' })
            return
          }
          runScript('apply-d1-schema.mjs', { ...process.env, CLOUDFLARE_D1_DATABASE: state.d1.databaseName })
          return
        }
        if (applySchema === 'done') {
          logEvent({ action: 'neon_schema_applied' })
          return
        }
        if (applySchema !== 'yes') {
          logEvent({ action: 'neon_schema_skip' })
          return
        }
        logEvent({ action: 'neon_schema_apply' })
        runScript('apply-schema.mjs', { ...process.env, PROFILE: 'prod' })
      },
    },
    {
      name: 'build',
      phase: 'build',
      run: () => {
        runCloudflareBuild()
      },
    },
    {
      name: 'deploy',
      phase: 'deploy',
      run: async () => {
        state.deploymentUrl = runCloudflareDeploy(pushSecrets(d1Mode))
        // The Workers.dev hostname is stable; re-resolve it from the account
        // instead of trusting the auth step's cached value, and fall back to
        // the deploy output for a first deploy on an account without one.
        const host = (await resolveDeployHost(cloudflareProjectName())) || hostOf(state.deploymentUrl)
        if (host) {
          state.productionHost = host
          state.appUrl = `https://${host}`
          logEvent({ action: 'cloudflare_production_domain', details: { domain: host } })
        }
        await verifyCloudflareSecrets(d1Mode)
      },
    },
  ]
}

function hostOf(url) {
  try {
    return new URL(String(url || '')).host
  } catch {
    return ''
  }
}

export const cloudflareTarget = {
  name: 'cloudflare',
  slots: ['setup', 'env', 'isolation', 'provision', 'schema', 'heartbeat', 'build', 'deploy'],
  // Env-sync capability (scheduled by the `env-sync` plugin): push the overlay
  // to the Worker, then re-resolve the production host when the auth step had
  // not cached one.
  envSync(ctx) {
    if (ctx.syncEnv !== 'yes') {
      logEvent({ action: 'cloudflare_env_sync_skip' })
      return
    }
    logEvent({ action: 'cloudflare_env_sync' })
    runScript('sync-cloudflare-env.mjs')
  },
  steps: cloudflareSteps,
}

export async function runCloudflareFlow({ syncEnv, applySchema, backend = 'neon', heartbeat, plugins = [] } = {}) {
  const startedAt = Date.now()
  const state = { appUrl: '', deploymentUrl: '', productionHost: '', d1: null }
  const ctx = { target: cloudflareTarget, syncEnv, applySchema, backend, heartbeat, state }
  const steps = assembleSteps(cloudflareTarget.slots, [...cloudflareTarget.steps(ctx), ...pluginSteps(plugins, ctx)])

  await runSteps('cloudflare', steps)

  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  console.log(
    `OK Cloudflare deploy complete -> ${state.appUrl} (preview ${state.deploymentUrl || 'unknown'}, ${formatElapsedTime(elapsed)})`,
  )
  return state.appUrl
}
