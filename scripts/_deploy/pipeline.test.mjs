// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { assembleSteps, pluginSteps } from './core.mjs'
import { heartbeatPlugin } from './plugins/heartbeat.mjs'
import { resolvePlugins } from './registry.mjs'
import { cloudflareTarget } from './targets/cloudflare.mjs'
import { vercelTarget } from './targets/vercel.mjs'
import { syncProjectDomains } from '../_vercel-domains.mjs'

// The assembled sequence is the contract: it must match the historical
// hard-coded step order so the plugin pipeline stays behavior-preserving.
const EXPECTED_CF = ['auth', 'project', 'env-sync', 'isolation', 'd1', 'schema', 'build', 'deploy']
const EXPECTED_CF_NO_SYNC = ['auth', 'project', 'isolation', 'd1', 'schema', 'build', 'deploy']
const EXPECTED_VERCEL = ['auth', 'env-sync', 'schema', 'domains', 'deploy', 'ready']
const EXPECTED_VERCEL_NO_SYNC = ['auth', 'schema', 'domains', 'deploy', 'ready']

function cfCtx(overrides = {}) {
  return {
    target: cloudflareTarget,
    syncEnv: 'no',
    applySchema: 'no',
    d1Mode: false,
    heartbeat: 'skip',
    state: { appUrl: '', deploymentUrl: '', productionHost: '', productionBranch: 'main', d1: null },
    ...overrides,
  }
}

function vercelCtx(overrides = {}) {
  return {
    target: vercelTarget,
    profile: 'prod',
    syncEnv: 'no',
    applySchema: 'no',
    heartbeat: 'skip',
    state: { appVersion: 'abc', deploymentUrl: '' },
    ...overrides,
  }
}

function stepNames(target, ctx, pluginNames) {
  return assembleSteps(target.slots, [...target.steps(ctx), ...pluginSteps(resolvePlugins(pluginNames), ctx)]).map(
    step => step.name,
  )
}

describe('cloudflare pipeline', () => {
  it('orders the intrinsic steps with env-sync in the env slot', () => {
    expect(stepNames(cloudflareTarget, cfCtx({ syncEnv: 'yes' }), ['env-sync'])).toEqual(EXPECTED_CF)
  })

  it('omits env-sync when the plugin is not selected', () => {
    expect(stepNames(cloudflareTarget, cfCtx(), [])).toEqual(EXPECTED_CF_NO_SYNC)
  })
})

describe('vercel pipeline', () => {
  it('orders the intrinsic steps with env-sync in the env slot', () => {
    expect(stepNames(vercelTarget, vercelCtx({ syncEnv: 'yes' }), ['env-sync'])).toEqual(EXPECTED_VERCEL)
  })

  it('omits env-sync when the plugin is not selected', () => {
    expect(stepNames(vercelTarget, vercelCtx(), [])).toEqual(EXPECTED_VERCEL_NO_SYNC)
  })

  it('places the link step before auth when the plugin is selected', () => {
    expect(stepNames(vercelTarget, vercelCtx({ syncEnv: 'yes' }), ['env-sync', 'vercel-link'])).toEqual([
      'link',
      'auth',
      'env-sync',
      'schema',
      'domains',
      'deploy',
      'ready',
    ])
  })
})

describe('vercel domain step', () => {
  it('hands the async reconciler to runSteps so its promise is not dropped', () => {
    const domains = vercelTarget.steps(vercelCtx()).find(step => step.name === 'domains')
    // A wrapper that calls syncProjectDomains() without returning it resolves
    // instantly and orphans the reconciliation: the deploy then finishes and
    // the stray promise later rejects as an unhandled rejection.
    expect(domains.run).toBe(syncProjectDomains)
  })
})

describe('plugin selection', () => {
  it('rejects an unknown plugin name', () => {
    expect(() => resolvePlugins(['nope'])).toThrow(/Unknown deploy plugin/)
  })

  it('drops steps from a disabled plugin', () => {
    const gated = { name: 'gated', enabled: () => false, steps: () => [{ name: 'gated', phase: 'schema', run: () => {} }] }
    expect(pluginSteps([gated], cfCtx())).toEqual([])
  })
})

describe('heartbeat placement', () => {
  it('sits before build on Cloudflare and after domains on Vercel', () => {
    const cf = cfCtx({ syncEnv: 'yes' })
    const cfNames = assembleSteps(cloudflareTarget.slots, [
      ...cloudflareTarget.steps(cf),
      ...pluginSteps(resolvePlugins(['env-sync']), cf),
      ...heartbeatPlugin.steps(cf),
    ]).map(step => step.name)
    expect(cfNames).toEqual(['auth', 'project', 'env-sync', 'isolation', 'd1', 'schema', 'heartbeat', 'build', 'deploy'])

    const vercel = vercelCtx({ syncEnv: 'yes' })
    const vercelNames = assembleSteps(vercelTarget.slots, [
      ...vercelTarget.steps(vercel),
      ...pluginSteps(resolvePlugins(['env-sync']), vercel),
      ...heartbeatPlugin.steps(vercel),
    ]).map(step => step.name)
    expect(vercelNames).toEqual(['auth', 'env-sync', 'schema', 'domains', 'heartbeat', 'deploy', 'ready'])
  })
})
