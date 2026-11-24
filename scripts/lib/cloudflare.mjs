#!/usr/bin/env node
// Shared Cloudflare Workers helpers: the generated root wrangler config, the
// worker-scoped wrangler commands, the Workers.dev host resolution, and D1
// provisioning. The generated config must sit at the project root under a
// standard name so every wrangler command auto-discovers it; the adapter's
// build output config (referenced from `.wrangler/deploy/config.json`) carries
// the Worker entry and static-asset directory.
//
// The runner and the fetch implementation are injectable so tests stay
// hermetic.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LOCAL_ONLY_ENV_KEYS } from '../env-file.mjs'
// Namespace import: `deploy.config.mjs` is app-owned, so an app whose copy
// predates the `secretKeys` export must still load; the set below then carries
// the shared defaults only.
import * as deployConfig from '../deploy.config.mjs'
import { logEvent } from '../log-event.mjs'
import { echoCommand } from '../_run.mjs'
import { loadTargetEnv } from './target-env.mjs'

export const GENERATED_WRANGLER_CONFIG = 'wrangler.toml'
export const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

// Static Workers stanza: compat only. `[vars]` below is rewritten by
// renderWranglerConfig (pruned to desired), so per-target values live in
// `.env.prod` + `.env.cloudflare`, never here. No `main` (the adapter sets the
// Worker entry) and no `assets` (the adapter fills the output config).
const WRANGLER_STATIC_STANZA = [
  'compatibility_date = "2026-09-01"',
  'compatibility_flags = ["nodejs_compat"]',
  '',
]

// `npx wrangler` pays package resolution on every invocation; a PATH
// wrangler skips it. Resolved once per process (every caller is short-lived,
// so no staleness concern); falls back to npx when absent.
let resolvedWranglerBin = null
export function wranglerBin() {
  if (!resolvedWranglerBin) {
    const probe = spawnSync('command -v wrangler', { shell: true, encoding: 'utf8' })
    resolvedWranglerBin = probe.status === 0 && probe.stdout.trim() ? 'wrangler' : 'npx'
  }
  return resolvedWranglerBin
}

// Full argv for the resolved wrangler binary: `npx` needs the shim name
// prepended, a PATH `wrangler` does not. Shared so every spawn site agrees.
export function wranglerArgs(args, bin = wranglerBin()) {
  return bin === 'npx' ? ['wrangler', ...args] : args
}

export function defaultWranglerRunner(args, { cwd, input, capture = false } = {}) {
  const bin = wranglerBin()
  // No `--config`: every worker command auto-discovers the generated root
  // config from `cwd`, and `deploy` follows `.wrangler/deploy/config.json` to
  // the adapter output.
  const fullArgs = wranglerArgs(args, bin)
  // Echo before every run, including captured ones, so logs show what executed.
  echoCommand(bin, fullArgs)
  const result = spawnSync(bin, fullArgs, {
    cwd,
    encoding: 'utf8',
    input,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

// Last non-empty lines of captured wrangler output, so failures carry the
// platform's own reason (bad token, missing account, network) instead of a
// bare exit code. Never includes credential values: wrangler prints
// diagnostics, not the token itself.
export function tailWranglerOutput(output, maxLines = 8) {
  return String(output || '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '')
    .slice(-maxLines)
    .join('\n')
    .trim()
}

function apiError(status, payload) {
  const detail = (payload?.errors || [])
    .map(error => error?.message)
    .filter(Boolean)
    .join('; ')
  return new Error(`Cloudflare API ${status}${detail ? `: ${detail}` : ''}`)
}

async function cfRequest({
  path,
  accountId,
  token,
  method = 'GET',
  body,
  fetchImpl = globalThis.fetch,
}) {
  if (!String(token || '').trim()) {
    throw new Error('CLOUDFLARE_API_TOKEN is empty: cannot manage the Workers deployment.')
  }
  if (!String(accountId || '').trim()) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is empty: cannot manage the Workers deployment.')
  }
  const response = await fetchImpl(`${CF_API_BASE}/accounts/${accountId}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw apiError(response.status, payload)
  }
  return payload.result
}

// Workers in the account. Doubles as the auth check: a bad token or account id
// fails here, before any deploy CLI runs.
export async function listWorkerScripts({ accountId, token, fetchImpl } = {}) {
  const result = await cfRequest({ path: '/workers/scripts', accountId, token, fetchImpl })
  return Array.isArray(result) ? result : []
}

export async function workerExists(project, options = {}) {
  const scripts = await listWorkerScripts(options)
  return scripts.some(entry => String(entry?.id || entry?.name || '').trim() === project)
}

// Account's workers.dev subdomain (`''` when the API is unavailable).
export async function fetchWorkersSubdomain({ accountId, token, fetchImpl } = {}) {
  const result = await cfRequest({ path: '/workers/subdomain', accountId, token, fetchImpl })
  return String(result?.subdomain || '').trim()
}

// Stable hostname for a Worker: `<worker>.<account-subdomain>.workers.dev`.
export function workersHost(project, subdomain) {
  const name = String(project || '').trim()
  const zone = String(subdomain || '').trim()
  if (!name || !zone) {
    return ''
  }
  return `${name}.${zone}.workers.dev`
}

// Name from the last generated config: fallback so a checkout that predates
// CLOUDFLARE_PROJECT keeps working. Shared by the env sync and the
// deploy/heartbeat flows so the fallback cannot drift.
export function generatedWranglerProjectName(root = process.cwd()) {
  try {
    const content = readFileSync(join(root, GENERATED_WRANGLER_CONFIG), 'utf8')
    return /^name\s*=\s*"([^"]+)"/m.exec(content)?.[1] || ''
  } catch {
    return ''
  }
}

// Worker name: the `CLOUDFLARE_PROJECT` overlay key owns it (mirrors
// VERCEL_PROJECT for Vercel); a stale generated config is the fallback so a
// checkout that predates the key keeps working. `merged` is the unified target
// env (loadTargetEnv('cloudflare')); `generatedName` lets tests inject the file
// value without touching disk.
export function resolveCloudflareProjectName(merged = {}, generatedName = '') {
  const fromOverlay = String(merged?.CLOUDFLARE_PROJECT || '').trim()
  if (fromOverlay) {
    return fromOverlay
  }
  return String(generatedName || '').trim()
}

// Production app URL for the Cloudflare target: the Worker's Workers.dev host,
// with `APP_BASE_URL` as the fallback for a custom domain. Throws when neither
// resolves. `env` and `fetchImpl` are injectable so tests stay hermetic (the
// default reads the real target env).
export async function resolveCloudflareAppUrl({ root = process.cwd(), env, fetchImpl } = {}) {
  const merged = env ?? loadTargetEnv('cloudflare', root)
  const project = resolveCloudflareProjectName(merged, generatedWranglerProjectName(root))
  if (!project) {
    throw new Error('Missing CLOUDFLARE_PROJECT in .env.cloudflare: set it to the Worker name.')
  }
  const subdomain = await fetchWorkersSubdomain({
    accountId: merged.CLOUDFLARE_ACCOUNT_ID,
    token: merged.CLOUDFLARE_API_TOKEN,
    fetchImpl,
  }).catch(error => {
    logEvent({ action: 'cloudflare_subdomain_warn', details: { error: error?.message || error, level: 'WARN' } })
    return ''
  })
  const host = workersHost(project, subdomain)
  if (host) {
    return `https://${host}`
  }
  const configured = String(merged.APP_BASE_URL || '').trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }
  throw new Error(
    `Could not resolve the Workers.dev host for ${project}: set a Workers Metadata Read token or APP_BASE_URL in .env.cloudflare.`,
  )
}

// Splits a file-env merge into the generator inputs: `project` from the
// overlay, `vars` (plain [vars], forced CF_WORKER/PROFILE applied at render),
// `secrets` (secret-store only). Local-only keys never sync; empty values keep
// the remote value. Shared by sync-cloudflare-env.mjs and deploy.mjs (auth-step
// generation) so the split cannot drift.
// Credential key names uploaded as Worker secrets instead of a plaintext
// [vars] entry. The defaults cover the shared surface; an app adds its own
// database/credential names through `secretKeys` in the ungated
// `deploy.config.json`, so a project-owned key never has to be hardcoded here.
export const CLOUDFLARE_SECRET_KEYS = new Set([
  'DATABASE_URL',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'SESSION_SECRET',
  'CRON_SECRET',
  'CLOUDFLARE_SCAN_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'VERCEL_TOKEN',
  'VERCEL_ACCOUNTS',
  'VERCEL_ACCOUNT_NAME',
  'VERCEL_TEAM_ID',
  'VERCEL_TEAM_SLUG',
  ...(Array.isArray(deployConfig.secretKeys) ? deployConfig.secretKeys : []),
])

// Keys that must never exist on the Worker, whatever the app: a synced Neon URL
// silently wins over the D1 binding, and synced Vercel credentials would
// re-couple the Cloudflare target to Vercel. The env sync removes secrets; the
// deploy's `[vars]` replaces plain vars.
export const CLOUDFLARE_FORBIDDEN_KEYS = new Set([
  'DATABASE_URL',
  'VERCEL_TOKEN',
  'VERCEL_ACCOUNTS',
  'VERCEL_ACCOUNT_NAME',
  'VERCEL_TEAM_ID',
  'VERCEL_TEAM_SLUG',
])

// Forbidden keys outside D1 mode: Vercel credentials must never exist on the
// Worker, but the Neon URL is the backend there. Derived by suffix so no
// per-app database key name lives in shared code.
export const NEON_MODE_FORBIDDEN_KEYS = new Set(
  [...CLOUDFLARE_FORBIDDEN_KEYS].filter(key => !key.endsWith('DATABASE_URL')),
)

// Isolation policy for the Cloudflare target, by backend: a D1-backed app must
// never carry the Neon URL (it silently wins over the D1 binding), so the full
// set applies; a Neon-backed app keeps DATABASE_URL in sync and forbids only
// Vercel credentials. Shared by the deploy flow and the env sync so both agree.
export function cloudflareForbiddenKeys(d1Mode) {
  return d1Mode ? CLOUDFLARE_FORBIDDEN_KEYS : NEON_MODE_FORBIDDEN_KEYS
}

export const CLOUDFLARE_LOCAL_ONLY_KEYS = LOCAL_ONLY_ENV_KEYS

export function splitCloudflareEnv(raw = {}, { forbidden = CLOUDFLARE_FORBIDDEN_KEYS } = {}) {
  const project = String(raw?.CLOUDFLARE_PROJECT || '').trim()
  const vars = {}
  const secrets = {}
  for (const [key, value] of Object.entries(raw)) {
    // Forbidden keys are neither vars nor secrets: a Neon URL or Vercel
    // credential left in the overlay must never be written to the Worker.
    // The set is injectable so Neon-backed apps (no D1) can forbid only
    // Vercel credentials; the default is the full isolation set.
    if (!value || CLOUDFLARE_LOCAL_ONLY_KEYS.has(key) || forbidden.has(key)) continue
    if (CLOUDFLARE_SECRET_KEYS.has(key)) {
      secrets[key] = value
    } else {
      vars[key] = value
    }
  }
  return { project, vars, secrets }
}

// Build vars forced into every Workers deploy, placed last so the overlay can
// never set a dev profile or a non-CF build. Single source of truth for the
// renderer and the env-var log.
export const FORCED_WORKER_VARS = { CF_WORKER: '1', PROFILE: 'prod' }

// Desired `[vars]` for a Workers deploy: overlay vars with the forced build
// vars last. Callers pass the result to renderWranglerConfig, so the deployed
// set and the rendered set cannot drift.
export function desiredWorkerVars(vars = {}) {
  return { ...vars, ...FORCED_WORKER_VARS }
}

// Renders the generated wrangler config: `name` from the overlay, the static
// Workers stanza, and `[vars]` pruned to exactly `vars`. Local-only keys must
// already be excluded by the caller, and the forced build vars come from
// desiredWorkerVars. Pure (string in, string out) so tests assert it without
// disk.
export function renderWranglerConfig({ project, vars = {}, d1 = null }) {
  const lines = [`name = ${JSON.stringify(project)}`, ...WRANGLER_STATIC_STANZA, '[vars]']
  for (const [key, value] of Object.entries(vars)) {
    lines.push(`${key} = ${JSON.stringify(String(value))}`)
  }
  if (d1) {
    // The binding name is per-app (callers pass it explicitly); no default
    // lives in shared code. Fail closed on a partial descriptor rather than
    // rendering `binding = undefined` into a config wrangler would push.
    for (const key of ['binding', 'databaseName', 'databaseId']) {
      if (!d1[key]) {
        throw new Error(`renderWranglerConfig: d1.${key} is required.`)
      }
    }
    lines.push(
      '',
      '[[d1_databases]]',
      `binding = ${JSON.stringify(d1.binding)}`,
      `database_name = ${JSON.stringify(d1.databaseName)}`,
      `database_id = ${JSON.stringify(d1.databaseId)}`,
    )
  }
  return `${lines.join('\n')}\n`
}

// D1 database name for the target overlay: CLOUDFLARE_D1_DATABASE, or '' when
// unset (callers fail loudly or apply their own default; shared code owns no
// per-app database name).
export function resolveD1DatabaseName(merged = {}) {
  return String(merged?.CLOUDFLARE_D1_DATABASE || '').trim()
}

// D1 database id from `wrangler d1 list --json`; '' when absent. Field names
// vary across wrangler versions (uuid vs database_id), so accept both.
export function findD1DatabaseId(listOutput, name) {
  const entry = (() => {
    try {
      const parsed = JSON.parse(String(listOutput || ''))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })().find(db => String(db?.name || '').trim() === name)
  return entry ? String(entry.uuid || entry.database_id || '').trim() : ''
}

// Idempotent D1 provisioning: list, create when missing, re-list for the id
// (wrangler's create output is not machine-readable). The runner is injectable
// so tests stub wrangler.
export function ensureD1Database(name, runner = defaultWranglerRunner, cwd = process.cwd()) {
  const list = () => runner(['d1', 'list', '--json'], { cwd, capture: true })
  const listed = list()
  if (listed.status !== 0) {
    const detail = tailWranglerOutput(listed.output)
    throw new Error(`wrangler d1 list failed (exit ${listed.status})${detail ? `: ${detail}` : '.'}`)
  }
  const existing = findD1DatabaseId(listed.output, name)
  if (existing) {
    return { status: 'exists', databaseId: existing }
  }
  console.log(`-> Creating Cloudflare D1 database ${name}...`)
  const created = runner(['d1', 'create', name], { cwd })
  if (created.status !== 0) {
    const detail = tailWranglerOutput(created.output)
    throw new Error(`Failed to create D1 database ${name} (exit ${created.status})${detail ? `: ${detail}` : '.'} Create it in the dashboard and retry.`)
  }
  const relisted = list()
  const createdId = findD1DatabaseId(relisted.output, name)
  if (!createdId) {
    throw new Error(`Created D1 database ${name} but could not resolve its id; run \`wrangler d1 list\` and retry.`)
  }
  return { status: 'created', databaseId: createdId }
}
