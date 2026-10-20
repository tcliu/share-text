#!/usr/bin/env node
// _deploy/preflight.mjs — decide which targets this checkout can deploy and
// fail fast before any deploy CLI runs. A target is available when every
// required env prop declared in `deploy.config.json` resolves, the
// credentials it needs are present (Cloudflare: CLOUDFLARE_API_TOKEN in the
// operator layer and CLOUDFLARE_ACCOUNT_ID in either layer), and its link intent
// resolves (Vercel: a link, `--project`, VERCEL_PROJECT, or an interactive run
// that can link). Required props are checked against the files whose values
// actually reach the remote target (the push universe), so a key that only lives
// in a non-synced file is reported missing; operator credentials are checked
// against `.env.local`/shell, which are never synced, while either-layer keys are
// accepted from the push universe or the operator layer.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT_DIR } from './core.mjs'
import { loadTargetEnvFiles, loadTargetFileEnv, loadTargetOperatorEnv, targetSourceLabel } from '../lib/target-env.mjs'
import { logEvent } from '../log-event.mjs'
import { TARGETS, TARGET_VALUES } from './registry.mjs'

// Operator-only credentials per target, checked against the operator layer
// (`.env.local`/shell), never the synced files; every listed key is required (a
// `KEY|KEY2` entry would instead mean either key satisfies it).
const TARGET_CREDENTIALS = {
  cloudflare: ['CLOUDFLARE_API_TOKEN'],
}

// Keys a target needs that may live in either the synced push universe
// (`targetSourceFiles`, e.g. `.env.cloudflare`) or the operator layer; a key
// present in either satisfies it. `CLOUDFLARE_ACCOUNT_ID` is documented in
// `.env.cloudflare` but is also commonly kept local.
const TARGET_ANY_LAYER_KEYS = {
  cloudflare: ['CLOUDFLARE_ACCOUNT_ID'],
}

// A spec is `KEY` or `A|B` (any one satisfies it).
function isSatisfied(env, spec) {
  return spec.split('|').some(key => String(env[key] ?? '').trim() !== '')
}

// Missing-config descriptions for one target, without logging or throwing.
// Empty means the target is deployable from this checkout. `linkTargets` lists
// the targets a selected plugin can link on demand; an interactive run can only
// link one of those (the Vercel link step is a plugin).
export function targetReadiness({
  target,
  requiredEnv = {},
  projectFlag = '',
  root = ROOT_DIR,
  interactive = Boolean(process.stdin.isTTY),
  linkTargets = [],
} = {}) {
  if (!TARGET_VALUES.includes(target)) {
    throw new Error(`Unknown deploy target for preflight: ${target}`)
  }
  const required = Array.isArray(requiredEnv[target]) ? requiredEnv[target] : []
  const env = loadTargetFileEnv(target, root)
  const missing = required.filter(spec => !isSatisfied(env, spec))

  // Operator credentials are never synced: validate them from the operator layer.
  const operator = loadTargetOperatorEnv(root)
  for (const spec of TARGET_CREDENTIALS[target] ?? []) {
    if (!isSatisfied(operator, spec)) {
      missing.push(`${spec} (shell or .env.local)`)
    }
  }
  // Either-layer keys are satisfied by the synced push universe or the operator
  // layer; check each source independently so an empty shell value cannot mask a
  // valid file value.
  for (const spec of TARGET_ANY_LAYER_KEYS[target] ?? []) {
    if (!isSatisfied(env, spec) && !isSatisfied(operator, spec)) {
      missing.push(`${spec} (${targetSourceLabel(target)} or shell/.env.local)`)
    }
  }

  if (target === 'vercel') {
    const linked = existsSync(join(root, '.vercel', 'project.json'))
    // A `--project` flag links (or switches) the checkout before the flow runs,
    // VERCEL_PROJECT may live in any file layer, and an interactive run can link
    // an unlinked checkout only when the link plugin is selected (`linkTargets`).
    // List the layers separately so an empty shell value cannot mask a file value.
    const projectConfigured = [
      projectFlag,
      loadTargetEnvFiles('vercel', root).VERCEL_PROJECT,
      process.env.VERCEL_PROJECT,
    ]
      .map(value => String(value ?? '').trim())
      .find(Boolean)
    if (!linked && !projectConfigured && !(interactive && linkTargets.includes('vercel'))) {
      missing.push('.vercel/project.json (run `vercel link`, pass --project, or set VERCEL_PROJECT)')
    }
  }
  return missing
}

// Readiness for every registered target, in registration order.
export function targetAvailability(options = {}) {
  return TARGETS.map(entry => {
    const missing = targetReadiness({ ...options, target: entry.value })
    return { value: entry.value, available: missing.length === 0, missing }
  })
}

export function preflightDeploy({
  target,
  requiredEnv = {},
  projectFlag = '',
  root = ROOT_DIR,
  interactive,
  linkTargets = [],
} = {}) {
  const missing = targetReadiness({ target, requiredEnv, projectFlag, root, interactive, linkTargets })
  if (missing.length > 0) {
    // Key names only — never values; the success twin is `deploy_preflight_end`.
    logEvent({ action: 'deploy_preflight_error', details: { target, missing } })
    throw new Error(
      `Missing required ${target} deploy config: ${missing.join(', ')}. ` +
        `Synced props are checked in ${targetSourceLabel(target)} and operator credentials in shell/.env.local. ` +
        'Set the missing key(s) and retry — no deploy CLI has run yet.',
    )
  }
  const required = Array.isArray(requiredEnv[target]) ? requiredEnv[target] : []
  logEvent({ action: 'deploy_preflight_end', details: { target, required: required.length } })
}
