#!/usr/bin/env node
// _vercel-cli.mjs — Vercel CLI plumbing shared by the deploy flow and the
// production-domain sync: binary resolution, API calls, output parsing, and
// deployment readiness waits. Dependency-light so both callers can import it
// without a cycle.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { echoCommand } from './_run.mjs'
import { logEvent } from './log-event.mjs'
import { ROOT_DIR, fail } from './_deploy/core.mjs'

const DEPLOY_MAX_ATTEMPTS = 3
const DEPLOY_RETRY_DELAY_MS = 5000
const DEPLOY_WAIT_TIMEOUT = '5m'

let vercelBinCache
function vercelBin() {
  if (vercelBinCache === undefined) {
    const found = spawnSync('command -v vercel', { shell: true, encoding: 'utf8' })
    vercelBinCache = found.status === 0 && found.stdout.trim() ? 'vercel' : null
  }
  return vercelBinCache
}

export function runVercelCli(args, { cwd = ROOT_DIR, capture = false } = {}) {
  const bin = vercelBin()
  const command = bin ?? 'npx'
  const fullArgs = bin ? args : ['vercel@latest', ...args]
  echoCommand(command, fullArgs)
  if (!capture) {
    const result = spawnSync(command, fullArgs, { cwd, stdio: 'inherit' })
    return { status: result.status ?? 1, output: '' }
  }
  const result = spawnSync(command, fullArgs, { cwd, encoding: 'utf8' })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

export function runVercelApi(path, extraArgs = [], { capture = true } = {}) {
  const apiDir = mkdtempSync(join(tmpdir(), 'deploy-api-'))
  try {
    return runVercelCli(['api', path, ...extraArgs], { cwd: apiDir, capture })
  } finally {
    rmSync(apiDir, { recursive: true, force: true })
  }
}

export function checkVercelAuth() {
  const { status } = runVercelCli(['whoami'], {
    capture: true,
  })
  // whoami prints the username on success; only the exit code matters here.
  if (status !== 0) {
    fail('Vercel CLI is not authenticated. Run `vercel login` and retry the deploy.')
  }
}

function extractJsonPayload(value) {
  const raw = String(value || '')
  const lineStart = raw.search(/(^|\r?\n)\s*\{/)
  const start = lineStart === -1 ? raw.indexOf('{') : raw.indexOf('{', lineStart)
  if (start === -1) return ''

  const end = raw.lastIndexOf('}')
  return end >= start ? raw.slice(start, end + 1) : raw.slice(start)
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w.-]+\.vercel\.app$/i.test(trimmed)) return `https://${trimmed}`
  return ''
}

export function extractDeploymentUrl(commandOutput) {
  const raw = String(commandOutput || '')
  const candidates = []
  const pushCandidate = value => {
    const normalized = normalizeUrl(value)
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized)
    }
  }

  const jsonPayload = extractJsonPayload(raw)
  if (jsonPayload) {
    try {
      const parsed = JSON.parse(jsonPayload)
      if (typeof parsed === 'string') {
        pushCandidate(parsed)
      } else if (parsed && typeof parsed === 'object') {
        pushCandidate(parsed.url)
        pushCandidate(parsed.inspectorUrl)
        if (Array.isArray(parsed.alias)) parsed.alias.forEach(pushCandidate)
        if (Array.isArray(parsed.aliases)) parsed.aliases.forEach(pushCandidate)
      }
    } catch (error) {
      console.error('Failed to parse deploy output JSON:', error?.message || error)
    }
  }

  for (const match of raw.match(/https?:\/\/[^\s"']+/g) || []) {
    pushCandidate(match)
  }
  for (const match of raw.match(/[\w.-]+\.vercel\.app/g) || []) {
    pushCandidate(match)
  }

  return candidates.length > 0 ? candidates[0] : ''
}

export function extractDeploymentId(commandOutput) {
  const payload = extractJsonPayload(String(commandOutput || ''))
  if (!payload) {
    return ''
  }
  try {
    const id = String(JSON.parse(payload)?.id || '').trim()
    return /^dpl_[A-Za-z0-9]+$/.test(id) ? id : ''
  } catch {
    return ''
  }
}

function deploymentReadyState(inspectOutput) {
  const payload = extractJsonPayload(inspectOutput)
  if (!payload) {
    return ''
  }

  try {
    const parsed = JSON.parse(payload)
    return String(parsed?.readyState || '').trim()
  } catch (error) {
    console.error('Failed to parse deployment inspect JSON:', error?.message || error)
    return ''
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// `vercel inspect --format json` omits the platform's block explanation, so
// pull it from the deployment API (diagnostics only; never fails the deploy).
function fetchDeploymentBlockDetail(deploymentId) {
  const empty = { reason: '', errorLink: '' }
  if (!deploymentId) {
    return empty
  }
  const { status, output } = runVercelApi(`/v13/deployments/${deploymentId}`)
  if (status !== 0) {
    return empty
  }
  try {
    const parsed = JSON.parse(output || '{}')
    return {
      reason: String(parsed?.readyStateReason || '').trim(),
      errorLink: String(parsed?.errorLink || '').trim(),
    }
  } catch {
    return empty
  }
}

export async function waitForReadyDeployment(deploymentUrl, deploymentId = '') {
  logEvent({
    action: 'vercel_deploy_wait',
    details: {
      deployment_url: deploymentUrl,
      log_command: `vercel inspect ${deploymentUrl} --logs --wait --timeout ${DEPLOY_WAIT_TIMEOUT}`,
    },
  })
  let inspectOutput = ''
  let inspectStatus = 0
  let logStatus = 0
  let readyState = ''

  for (let attempt = 1; attempt <= DEPLOY_MAX_ATTEMPTS; attempt++) {
    const logResult = runVercelCli(['inspect', deploymentUrl, '--logs', '--wait', '--timeout', DEPLOY_WAIT_TIMEOUT])
    logStatus = logResult.status
    const inspectResult = runVercelCli(['inspect', deploymentUrl, '--format', 'json'], { capture: true })
    inspectOutput = inspectResult.output
    inspectStatus = inspectResult.status

    readyState = deploymentReadyState(inspectOutput)
    if (readyState === 'READY') {
      return
    }

    if ((logStatus === 0 && inspectStatus === 0) || attempt >= DEPLOY_MAX_ATTEMPTS) {
      break
    }

    console.error(
      `-> Inspect attempt ${attempt}/${DEPLOY_MAX_ATTEMPTS} did not reach READY ` +
        `(logs exit ${logStatus}, inspect exit ${inspectStatus}). Retrying in ${DEPLOY_RETRY_DELAY_MS / 1000}s...`,
    )
    await sleep(DEPLOY_RETRY_DELAY_MS)
  }

  if (readyState) {
    console.error(`Vercel deployment did not reach READY (state: ${readyState}) -> ${deploymentUrl}`)
  } else {
    console.error(`Vercel deployment did not reach READY -> ${deploymentUrl}`)
  }

  if (inspectOutput) {
    console.error(inspectOutput)
  }

  const { reason, errorLink } = fetchDeploymentBlockDetail(deploymentId)
  if (reason) {
    console.error(`Vercel block reason: ${reason}`)
  }
  if (errorLink) {
    console.error(`Reference: ${errorLink}`)
  }

  const error = new Error(
    `Vercel deployment did not reach READY${readyState ? ` (state: ${readyState})` : ''} -> ${deploymentUrl}`,
  )
  error.exitCode = inspectStatus !== 0 ? inspectStatus : logStatus !== 0 ? logStatus : 1
  throw error
}

export async function runDeployWithRetry(appVersion) {
  let output = ''
  let status = 1

  for (let attempt = 1; attempt <= DEPLOY_MAX_ATTEMPTS; attempt++) {
    const bin = vercelBin()
    const fullArgs = [
      ...(bin ? [] : ['vercel@latest']),
      'deploy',
      '--prod',
      '--yes',
      '--no-wait',
      '--format',
      'json',
    ]
    echoCommand(bin ?? 'npx', fullArgs)
    const result = spawnSync(bin ?? 'npx', fullArgs, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      env: { ...process.env, APP_VERSION: appVersion },
    })
    status = result.status ?? 1
    output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    process.stderr.write(output)

    if (status === 0) {
      return output
    }

    if (attempt < DEPLOY_MAX_ATTEMPTS) {
      console.error(
        `-> Deploy attempt ${attempt}/${DEPLOY_MAX_ATTEMPTS} failed (exit ${status}). ` +
          `Retrying in ${DEPLOY_RETRY_DELAY_MS / 1000}s...`,
      )
      await sleep(DEPLOY_RETRY_DELAY_MS)
    }
  }

  const error = new Error(`Vercel deploy failed after ${DEPLOY_MAX_ATTEMPTS} attempts (exit ${status}).`)
  error.exitCode = status
  throw error
}
