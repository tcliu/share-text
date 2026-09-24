#!/usr/bin/env node
// _vercel-domains.mjs — reconcile the Vercel project's production domain with
// APP_BASE_URL: read the recorded managed domain, add the configured one, and
// remove stale *.vercel.app aliases. A hostname owned elsewhere is a warning
// (the deploy continues at the project's own URL), never a fatal error. Built
// on `_vercel-cli.mjs`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseEnvFile } from './env-file.mjs'
import { logEvent } from './log-event.mjs'
import { ROOT_DIR, fail } from './_deploy/core.mjs'
import { runVercelApi } from './_vercel-cli.mjs'

const DOMAIN_STATE_FILE = join(ROOT_DIR, '.vercel', 'domain-state.json')

export function configuredBaseUrl() {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.trim()
  }
  const merged = {
    ...parseEnvFile(join(ROOT_DIR, '.env')),
    ...parseEnvFile(join(ROOT_DIR, '.env.vercel')),
  }
  return String(merged.APP_BASE_URL || '').trim()
}

function configuredDomain() {
  const baseUrl = configuredBaseUrl()
  if (!baseUrl) {
    fail('Missing APP_BASE_URL in shell env, .env, or .env.vercel.')
  }
  try {
    return new URL(baseUrl).hostname
  } catch {
    fail(`APP_BASE_URL must be a valid absolute URL. Received: ${baseUrl}`)
  }
}

function projectId() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT_DIR, '.vercel', 'project.json'), 'utf8'))
    return String(data.projectId || '')
  } catch {
    return ''
  }
}

function readManagedDomainState() {
  if (!existsSync(DOMAIN_STATE_FILE)) {
    return ''
  }
  try {
    const state = JSON.parse(readFileSync(DOMAIN_STATE_FILE, 'utf8'))
    return String(state.managedDomain || '').trim()
  } catch (error) {
    console.error('Failed to read managed domain state:', error?.message || error)
    return ''
  }
}

function writeManagedDomainState(managedDomain) {
  mkdirSync(dirname(DOMAIN_STATE_FILE), { recursive: true })
  writeFileSync(DOMAIN_STATE_FILE, JSON.stringify({ managedDomain }, null, 2) + '\n')
}

function listOtherVercelAppDomains(projectIdValue, currentDomain) {
  const { status, output } = runVercelApi(`/v9/projects/${projectIdValue}/domains`)
  if (status !== 0) {
    fail('Failed to list Vercel project domains. Check `vercel whoami` auth and network, then retry.')
  }
  let payload = {}
  try {
    payload = JSON.parse(output || '{}')
  } catch {
    fail('Failed to parse Vercel project domains output. Re-run with a working `vercel` CLI and retry.')
  }
  const recordedDomain = readManagedDomainState()
  const domains = Array.isArray(payload) ? payload : Array.isArray(payload.domains) ? payload.domains : []
  const names = domains
    .map(entry => String(typeof entry === 'string' ? entry : entry?.name || '').trim())
    .filter(name => name && name.endsWith('.vercel.app') && name !== currentDomain)

  const prioritized =
    recordedDomain && names.includes(recordedDomain)
      ? [recordedDomain, ...names.filter(name => name !== recordedDomain)]
      : names

  return prioritized
}

// Attaches the production domain. Returns a discriminated status: 'attached'
// when the hostname is (or becomes) on the project, 'conflict' when the add
// was refused because the hostname is taken elsewhere (the caller retries with
// a fresh URL), 'error' for anything else (auth, network, rate limit) — a
// misclassified transport error must never masquerade as a taken hostname.
const DOMAIN_CONFLICT_PATTERN = /already|in use|is taken|unavailable|reserved|used by/i

function ensureProjectDomain(projectIdValue, domain) {
  const { status } = runVercelApi(`/v9/projects/${projectIdValue}/domains/${domain}`)
  if (status === 0) {
    return { status: 'attached' }
  }
  const added = runVercelApi(`/v10/projects/${projectIdValue}/domains`, ['-X', 'POST', '-f', `name=${domain}`], {
    capture: true,
  })
  if (added.status !== 0) {
    const detail = added.output.trim().split('\n').slice(-1)[0] || `vercel exited ${added.status}`
    if (DOMAIN_CONFLICT_PATTERN.test(added.output)) {
      logEvent({ action: 'vercel_domain_conflict', details: { project_id: projectIdValue, domain } })
      return { status: 'conflict' }
    }
    logEvent({ action: 'vercel_domain_add_error', details: { project_id: projectIdValue, domain, error: detail } })
    return { status: 'error', message: detail }
  }
  if (runVercelApi(`/v9/projects/${projectIdValue}/domains/${domain}`).status === 0) {
    logEvent({ action: 'vercel_domain_add', details: { project_id: projectIdValue, domain } })
    return { status: 'attached' }
  }
  return { status: 'error', message: 'added but not listed' }
}

function removeProjectDomain(projectIdValue, domain) {
  if (!domain) {
    return
  }
  const { status } = runVercelApi(`/v9/projects/${projectIdValue}/domains/${domain}`)
  if (status !== 0) {
    return
  }
  console.log(`-> Removing previous production domain ${domain}...`)
  const removed = runVercelApi(
    `/v9/projects/${projectIdValue}/domains/${domain}`,
    ['-X', 'DELETE', '--dangerously-skip-permissions'],
    { capture: false },
  )
  if (removed.status === 0) {
    logEvent({ action: 'vercel_domain_remove', details: { project_id: projectIdValue, domain } })
  }
}

// Reconcile the configured production domain. A hostname owned elsewhere is a
// warning, not a failure: the deploy still serves from the project's own
// *.vercel.app URL, so an unclaimable vanity domain must not block production.
// Any other failure (auth, network, rate limit) stays fatal so a transport
// error can never masquerade as an unavailable domain.
export async function syncProjectDomains() {
  const projectIdValue = projectId()
  if (!projectIdValue) {
    fail('Failed to determine the Vercel project ID from .vercel/project.json.')
  }

  const configuredDomainValue = configuredDomain()
  const claimed = ensureProjectDomain(projectIdValue, configuredDomainValue)
  if (claimed.status === 'attached') {
    for (const obsoleteDomain of listOtherVercelAppDomains(projectIdValue, configuredDomainValue)) {
      if (!obsoleteDomain) continue
      removeProjectDomain(projectIdValue, obsoleteDomain)
    }
    writeManagedDomainState(configuredDomainValue)
    return
  }
  if (claimed.status === 'error') {
    throw new Error(`Failed to attach domain ${configuredDomainValue}: ${claimed.message}`)
  }
  logEvent({
    action: 'vercel_domain_skip',
    details: { domain: configuredDomainValue, reason: 'unavailable', level: 'WARN' },
  })
  console.log(`-> WARN domain ${configuredDomainValue} is unavailable (owned elsewhere); deploying without it.`)
}
