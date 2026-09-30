#!/usr/bin/env node
// _deploy/targets/cloudflare.mjs — Cloudflare Pages deploy target: project
// assurance, env sync, D1 provisioning/binding, isolation gate, build, and
// Pages deploy. Built on the shared deploy core (`../core.mjs`) and lib/.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { logEvent } from '../../log-event.mjs'
import { formatCommand } from '../../_run.mjs'
import { assembleSteps, pluginSteps, ROOT_DIR, fail, formatElapsedTime, runScript, runSteps } from '../core.mjs'
import {
  CLOUDFLARE_FORBIDDEN_KEYS,
  cloudflareForbiddenKeys,
  GENERATED_WRANGLER_CONFIG,
  desiredPagesVars,
  ensureD1Database,
  ensurePagesProject,
  generatedWranglerProjectName,
  getPagesProjectDomain,
  renderWranglerConfig,
  resolveCloudflareProjectName,
  resolveD1DatabaseName,
  splitCloudflareEnv,
  wranglerBin,
} from '../../lib/cloudflare.mjs'
import { diffDesiredVars, fetchPagesEnvState } from '../../lib/cloudflare-pages-env.mjs'
import { loadTargetEnv, loadTargetFileEnv } from '../../lib/target-env.mjs'

// Cloudflare Pages target. Reads `.env.prod` overlaid by `.env.cloudflare`
// (never `.env.vercel`), so the two targets keep independent URLs; the Neon
// schema step is shared (see the deploy flow). Load order matches
// loadTargetEnv: `.env` < `.env.local` < `.env.prod` < overlay < shell.
function cloudflareEnv() {
  return loadTargetEnv('cloudflare', ROOT_DIR)
}

async function cloudflareApi(path, { method = 'GET', body } = {}) {
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim()
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN is empty: cannot manage Pages custom domains.')
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  return { ok: response.ok && payload.success !== false, payload }
}

// Production branch of the Pages project. `pages project list --json` omits
// it, so read the project object. Required because `wrangler pages deploy`
// defaults to the *checkout* branch: a deploy from a worktree (the default
// workflow) would otherwise land as a non-production preview while the run
// still reports success.
async function cloudflareProductionBranch(project) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is empty: cannot resolve the Pages production branch.')
  }
  const response = await cloudflareApi(`/accounts/${accountId}/pages/projects/${project}`)
  if (!response.ok) {
    throw new Error(`Failed to read Pages project ${project} (production branch).`)
  }
  return String(response.payload?.result?.production_branch || '').trim()
}

function cloudflareProjectName() {
  // Overlay owns the name (mirrors VERCEL_PROJECT); the generated config is
  // the fallback so a checkout that predates the key keeps working.
  const name = resolveCloudflareProjectName(cloudflareEnv(), generatedWranglerProjectName(ROOT_DIR))
  if (!name) {
    throw new Error('Missing CLOUDFLARE_PROJECT in .env.cloudflare: set it to the Pages project name.')
  }
  return name
}

function seedWranglerToken() {
  // Wrangler authenticates from the process env, but the operator token lives
  // in `.env.local` (never synced anywhere): seed it so `wrangler` children
  // see it. Shell values always win.
  const merged = loadTargetEnv('cloudflare', ROOT_DIR)
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
    if (!process.env[key] && String(merged[key] || '').trim()) {
      process.env[key] = String(merged[key]).trim()
    }
  }
}

// Regenerates the gitignored root `wrangler.toml` from the overlay
// (idempotent, so both the auth step and env-sync can call it): `--no-sync-env`
// runs still get a complete config for `pages deploy` (env-sync rewrites it to
// the drifted-only set when it runs). Split shared with
// sync-cloudflare-env.mjs so vars/secrets/local-only handling cannot drift.
function ensureGeneratedConfig(d1 = null) {
  const { vars } = splitCloudflareEnv(loadTargetFileEnv('cloudflare', ROOT_DIR))
  const project = cloudflareProjectName()
  writeFileSync(
    join(ROOT_DIR, GENERATED_WRANGLER_CONFIG),
    renderWranglerConfig({ project, vars: desiredPagesVars(vars), d1 }),
  )
  return project
}

// Auth + project assurance in a single `pages project list`: verifies the
// token (bad auth fails the list) and creates the Pages project when
// missing, so the env-sync child (PAGES_PROJECT_ASSURED) and the no-sync
// project step below never list a second time. The flag doubles as the
// success marker: when the auth step fails but an interactive caller
// continues anyway, the project step retries the assurance.
function ensureCloudflareProjectAssured() {
  seedWranglerToken()
  const project = cloudflareProjectName()
  const hasToken = Boolean(String(process.env.CLOUDFLARE_API_TOKEN || '').trim())
  const hasAccountId = Boolean(String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim())
  const context = `project "${project}", wrangler bin "${wranglerBin()}", token ${hasToken ? 'present' : 'missing'}, account ${hasAccountId ? 'present' : 'missing'}`
  try {
    ensurePagesProject(project)
  } catch (error) {
    throw new Error(
      `Cloudflare Pages project check failed (${context}): ${error?.message || error} ` +
        'Set CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID for scoped tokens) in shell or .env.local and retry the deploy.',
    )
  }
  process.env.PAGES_PROJECT_ASSURED = '1'
}

function runCloudflareBuild() {
  console.log(`${formatCommand('npm', ['run', 'build'])} (CF_PAGES=1)`)
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, CF_PAGES: '1' },
  })
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Cloudflare build failed (exit ${result.status ?? 1}).`)
  }
}

function runCloudflareDeploy(branch = '') {
  const project = cloudflareProjectName()
  const bin = wranglerBin()
  // No `--config`: Pages rejects custom config paths and auto-discovers the
  // generated root `wrangler.toml`; `--project-name` selects the Pages project
  // since the config carries no account binding. `--branch` pins the deploy to
  // the project's production branch so a worktree checkout still ships to prod.
  const args = ['pages', 'deploy', '.svelte-kit/cloudflare', '--project-name', project]
  if (branch) {
    args.push('--branch', branch)
  }
  const fullArgs = bin === 'npx' ? ['wrangler', ...args] : args
  console.log(formatCommand(bin, fullArgs))
  const result = spawnSync(bin, fullArgs, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stderr.write(output)
  if ((result.status ?? 1) !== 0) {
    throw new Error(`wrangler pages deploy failed (exit ${result.status ?? 1}).`)
  }
  const match = /https:\/\/[^\s"']+\.pages\.dev/.exec(output)
  return match ? match[0] : ''
}

// D1 mode is explicit: the Cloudflare flow provisions, binds, and bootstraps
// a D1 database only when CLOUDFLARE_D1_DATABASE names one; otherwise the
// target runs on the existing Neon backend (same file deploys both kinds).
export function isCloudflareD1Mode() {
  return resolveD1DatabaseName(loadTargetEnv('cloudflare', ROOT_DIR)) !== ''
}

// D1 binding name derived from the package name (`my-app` -> `MY_APP_D1`), so
// the file carries no per-app literals. Callers in
// D1 mode always pass it explicitly to renderWranglerConfig.
function d1BindingName() {
  let pkg = ''
  try {
    pkg = String(JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8')).name || '')
  } catch {
    pkg = ''
  }
  const slug = pkg
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/^PROJECT_/, '')
  return `PROJECT_${slug || 'APP'}_D1`
}

// Hard isolation gate: forbidden keys on the Pages project are a fatal
// misconfiguration (in D1 mode a remote Neon URL silently wins over the D1
// binding; anywhere, Vercel credentials re-couple the target). The env sync
// removes them; this re-reads to prove it and aborts before build/deploy when
// one survives. A failed read is only a warning — the sync already did its
// best.
async function assertCloudflareIsolation(forbidden = CLOUDFLARE_FORBIDDEN_KEYS) {
  let envVars
  try {
    ;({ envVars } = await fetchPagesEnvState({
      project: cloudflareProjectName(),
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    }))
  } catch (error) {
    logEvent({ action: 'cloudflare_isolation_skip', details: { error: error?.message || error, level: 'WARN' } })
    return
  }
  const found = Object.keys(envVars).filter(key => forbidden.has(key))
  if (found.length > 0) {
    throw new Error(
      `Cloudflare Pages still carries forbidden key(s): ${found.join(', ')}. ` +
        'Re-run `npm run env:sync:cloudflare -- --prune` and retry.',
    )
  }
}

// Post-deploy safety net: `wrangler pages deploy` replaces the managed plain
// vars with the generated `[vars]` (which the sync always writes in full), so a
// missing key means the deploy dropped something. Re-read the remote plain vars
// and warn on any desired key that is missing or different; never fails the
// deploy.
async function verifyCloudflareEnvVars() {
  try {
    const { vars } = splitCloudflareEnv(loadTargetFileEnv('cloudflare', ROOT_DIR))
    const { envVars } = await fetchPagesEnvState({
      project: cloudflareProjectName(),
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    })
    const { missing, changed } = diffDesiredVars(desiredPagesVars(vars), envVars)
    const drifted = [...missing, ...changed]
    if (drifted.length > 0) {
      console.error(
        `-> WARNING: Cloudflare Pages does not match ${drifted.length} desired var(s) (${drifted.join(', ')}). ` +
          'Re-run the Cloudflare deploy to re-apply the full [vars] set.',
      )
    }
  } catch (error) {
    logEvent({ action: 'cloudflare_verify_skip', details: { error: error?.message || error, level: 'WARN' } })
  }
}

// Intrinsic Cloudflare steps: the capabilities the CF target always runs
// (project assurance, isolation gate, D1 provisioning, schema apply, build,
// ship). Cross-cutting capabilities are appended by the plugin pipeline.
function cloudflareSteps(ctx) {
  const { applySchema, d1Mode, state, syncEnv } = ctx
  // The auth step resolves the live URL from the Pages project (below); no
  // APP_BASE_URL exists on this target.
  return [
    {
      name: 'auth',
      phase: 'setup',
      run: async () => {
        // Generate first: the deploy and secret writes need the config at its
        // standard root path; this also makes --no-sync-env work on a fresh
        // checkout.
        ensureGeneratedConfig()
        ensureCloudflareProjectAssured()
        const project = cloudflareProjectName()
        state.productionHost = getPagesProjectDomain(project)
        if (!state.productionHost) {
          throw new Error(
            `Could not resolve the Pages production domain for project ${project}: check wrangler auth and retry.`,
          )
        }
        // The live URL is the production domain: derived, never configured.
        state.appUrl = `https://${state.productionHost}`
        state.productionBranch = await cloudflareProductionBranch(project)
        if (!state.productionBranch) {
          logEvent({ action: 'cloudflare_production_branch_unresolved', details: { level: 'WARN' } })
        }
      },
    },
    {
      name: 'project',
      phase: 'setup',
      run: () => {
        if (syncEnv === 'yes' || process.env.PAGES_PROJECT_ASSURED === '1') return
        ensurePagesProject(cloudflareProjectName())
      },
    },
    {
      name: 'isolation',
      phase: 'isolation',
      run: async () => {
        // Runs regardless of --sync-env: a surviving forbidden key would
        // silently re-couple the target (Neon URL over D1 in D1 mode,
        // Vercel credentials anywhere).
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
        state.d1 = { binding: d1BindingName(), databaseName, databaseId }
        logEvent({
          action: status === 'created' ? 'd1_database_created' : 'd1_database_ready',
          details: { databaseName, databaseId },
        })
        // Regenerate the config with the binding: the env sync writes it without
        // one, and `wrangler pages deploy` reads the config at deploy time.
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
        state.deploymentUrl = runCloudflareDeploy(state.productionBranch)
        // The deploy output carries the one-off preview URL; the stable site
        // is the production domain (the account may suffix the subdomain, so
        // re-resolve it from the project instead of trusting the auth step's
        // cached host).
        const productionHost = getPagesProjectDomain(cloudflareProjectName())
        if (productionHost) {
          state.productionHost = productionHost
          state.appUrl = `https://${productionHost}`
          logEvent({ action: 'cloudflare_production_domain', details: { domain: productionHost } })
        }
        await verifyCloudflareEnvVars()
      },
    },
  ]
}

export const cloudflareTarget = {
  name: 'cloudflare',
  slots: ['setup', 'env', 'isolation', 'provision', 'schema', 'heartbeat', 'build', 'deploy'],
  // Env-sync capability (scheduled by the `env-sync` plugin): push the overlay
  // to the Pages project, then re-resolve the production host when the auth
  // step had not cached one.
  envSync(ctx) {
    if (ctx.syncEnv !== 'yes') {
      logEvent({ action: 'cloudflare_env_sync_skip' })
      return
    }
    logEvent({ action: 'cloudflare_env_sync' })
    runScript('sync-cloudflare-env.mjs')
    ctx.state.productionHost = ctx.state.productionHost || getPagesProjectDomain(cloudflareProjectName())
  },
  steps: cloudflareSteps,
}

export async function runCloudflareFlow({ syncEnv, applySchema, d1Mode, heartbeat, plugins = [] } = {}) {
  const startedAt = Date.now()
  const state = { appUrl: '', deploymentUrl: '', productionHost: '', productionBranch: '', d1: null }
  const ctx = { target: cloudflareTarget, syncEnv, applySchema, d1Mode, heartbeat, state }
  const steps = assembleSteps(cloudflareTarget.slots, [
    ...cloudflareTarget.steps(ctx),
    ...pluginSteps(plugins, ctx),
  ])

  await runSteps('cloudflare', steps)

  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  console.log(
    `OK Cloudflare deploy complete -> ${state.appUrl} (preview ${state.deploymentUrl || 'unknown'}, ${formatElapsedTime(elapsed)})`,
  )
  return state.appUrl
}
