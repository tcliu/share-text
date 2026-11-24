#!/usr/bin/env node
// _deploy/targets/vercel.mjs — Vercel deploy target: link/auth check, env sync
// (via the `env-sync` plugin), optional Neon schema apply, `vercel deploy`
// with a READY wait, and production-domain reconciliation.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { errorMessage, logEvent } from '../../log-event.mjs'
import { readJsonFile } from '../../env-file.mjs'
import { assembleSteps, formatElapsedTime, pluginSteps, ROOT_DIR, runScript, runSteps } from '../core.mjs'
import {
  checkVercelAuth,
  extractDeploymentId,
  extractDeploymentUrl,
  runDeployWithRetry,
  runVercelApi,
  waitForReadyDeployment,
} from '../../_vercel-cli.mjs'
import { configuredBaseUrl, syncProjectDomains } from '../../_vercel-domains.mjs'


// Deployment Protection for the production aliases (`deploy.config.json` →
// `vercelProtection`). `public` disables Vercel Authentication, `preview` keeps
// preview deployments protected while production stays open, and `all` protects
// everything. Absent leaves the dashboard setting untouched.
function normalizeProtection(value) {
  const mode = String(value ?? '').trim().toLowerCase()
  if (!mode) return ''
  if (!['public', 'preview', 'all'].includes(mode)) {
    throw new Error(`deploy.config.json vercelProtection must be "public", "preview", or "all" (got "${value}")`)
  }
  return mode
}

function readVercelLink() {
  const link = readJsonFile(join(ROOT_DIR, '.vercel', 'project.json'), {})
  return {
    projectId: String(link?.projectId || '').trim(),
    orgId: String(link?.orgId || '').trim(),
  }
}

// Intrinsic Vercel steps: link/auth, the schema apply, the ship + READY wait,
// and production-domain reconciliation. Env sync is appended by the plugin
// pipeline.
function vercelSteps(ctx) {
  const { applySchema, profile, state } = ctx
  const protection = normalizeProtection(ctx.vercelProtection)
  const steps = [
    {
      name: 'auth',
      phase: 'setup',
      run: () => {
        if (!existsSync(join(ROOT_DIR, '.vercel', 'project.json'))) {
          throw new Error(`Missing .vercel/project.json in ${ROOT_DIR}. Run 'vercel link' from the repo root first.`)
        }
        checkVercelAuth()
        console.log(`-> Profile: ${profile}`)
      },
    },
    {
      name: 'protection',
      phase: 'setup',
      run: () => {
        const { projectId, orgId } = readVercelLink()
        if (!projectId) {
          console.warn('-> Deployment protection skipped: no projectId in .vercel/project.json.')
          return
        }
        const body = { ssoProtection: protection === 'public' ? null : { deploymentType: protection } }
        const query = orgId ? `?teamId=${encodeURIComponent(orgId)}` : ''
        const { status, output } = runVercelApi(`/v9/projects/${projectId}${query}`, [], {
          method: 'PATCH',
          body,
        })
        if (status !== 0) {
          console.warn(
            `-> Deployment protection update failed; the dashboard setting is unchanged. ${String(output).trim().split('\n')[0]}`,
          )
          return
        }
        console.log(`-> Deployment protection: ${protection}`)
      },
    },
    {
      name: 'schema',
      phase: 'schema',
      run: () => {
        if (applySchema === 'yes') {
          console.log('-> Applying sql/schema.sql...')
          runScript('apply-schema.mjs', { ...process.env, PROFILE: 'prod' })
        } else if (applySchema === 'done') {
          // The shared step already applied it.
        } else {
          console.log('-> Skipping schema apply; the schema must already be applied.')
        }
      },
    },
    {
      name: 'domains',
      phase: 'domains',
      // Hand the async reconciler to `runSteps` directly: a wrapper that calls
      // it without returning would resolve instantly, letting a later domain
      // failure surface as an unhandled rejection after the deploy completes.
      run: syncProjectDomains,
    },
    {
      name: 'deploy',
      phase: 'deploy',
      run: async () => {
        console.log('-> Deploying to Vercel...')
        state.deployOutput = await runDeployWithRetry(state.appVersion)
        const deploymentUrl = extractDeploymentUrl(state.deployOutput)
        if (!deploymentUrl) {
          console.error(state.deployOutput)
          throw new Error('Failed to determine the Vercel deployment URL.')
        }
        state.deploymentUrl = deploymentUrl
        state.deploymentId = extractDeploymentId(state.deployOutput)
      },
    },
    {
      name: 'ready',
      phase: 'ready',
      run: () => waitForReadyDeployment(state.deploymentUrl, state.deploymentId),
    },
  ]
  return protection ? steps : steps.filter(step => step.name !== 'protection')
}

export const vercelTarget = {
  name: 'vercel',
  slots: ['link', 'setup', 'env', 'schema', 'domains', 'heartbeat', 'deploy', 'ready'],
  // Env-sync capability (scheduled by the `env-sync` plugin): push
  // `.env.vercel` to the Vercel production env.
  envSync(ctx) {
    if (ctx.syncEnv === 'yes') {
      console.log('-> Syncing .env.vercel to Vercel production env...')
      runScript('sync-vercel-env.mjs')
    } else {
      console.log('-> Skipping Vercel env sync; the dashboard env must already carry PROFILE=prod.')
    }
  },
  steps: vercelSteps,
}

export async function runVercelFlow({
  profile,
  syncEnv,
  applySchema,
  heartbeat,
  projectFlag,
  vercelProtection,
  plugins = [],
} = {}) {
  const startedAt = Date.now()
  let appVersion = 'unknown'
  try {
    console.log(`+ git -C ${ROOT_DIR} rev-parse HEAD`)
    const result = spawnSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    if (result.status === 0 && result.stdout.trim()) {
      appVersion = result.stdout.trim()
    }
  } catch {
    // keep 'unknown'
  }
  const baseUrl = configuredBaseUrl()
  // The orchestrator logs `deploy_start` for every target; this entry carries
  // only the version the Vercel flow resolved, so the same event is not emitted
  // twice under one name with different shapes.
  logEvent({ action: 'deploy_version', details: { target: 'vercel', app_version: appVersion } })

  const ctx = {
    target: vercelTarget,
    profile,
    syncEnv,
    applySchema,
    heartbeat,
    vercelProtection,
    projectFlag,
    state: { appVersion, deploymentUrl: '', deploymentId: '', deployOutput: '' },
  }
  try {
    const steps = assembleSteps(vercelTarget.slots, [
      ...vercelTarget.steps(ctx),
      ...pluginSteps(plugins, ctx),
    ])
    await runSteps('vercel', steps)

    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    const liveUrl = configuredBaseUrl() || baseUrl
    logEvent({
      action: 'deploy_end',
      details: {
        profile,
        target: 'vercel',
        deployment_url: ctx.state.deploymentUrl,
        base_url: liveUrl,
        elapsed_ms: Date.now() - startedAt,
      },
    })
    console.log(`OK Vercel deploy complete -> ${liveUrl} (${formatElapsedTime(elapsed)})`)
    return liveUrl
  } catch (error) {
    logEvent({
      action: 'deploy_error',
      details: { profile, target: 'vercel', elapsed_ms: Date.now() - startedAt, error: errorMessage(error) },
    })
    throw error
  }
}
