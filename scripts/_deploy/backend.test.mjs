// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { planDeployBackends, resolveDeployBackend } from './backend.mjs'

describe('resolveDeployBackend', () => {
  it('selects D1 when Cloudflare configures a D1 database', () => {
    expect(resolveDeployBackend('cloudflare', { CLOUDFLARE_D1_DATABASE: 'tts-db' })).toBe('d1')
  })

  it('selects Neon for Cloudflare without a D1 database', () => {
    expect(resolveDeployBackend('cloudflare', { DATABASE_URL: 'postgres://db' })).toBe('neon')
  })

  it('selects Neon for every non-Cloudflare target regardless of config', () => {
    expect(resolveDeployBackend('vercel', { CLOUDFLARE_D1_DATABASE: 'tts-db' })).toBe('neon')
  })

  it('defaults to Neon with no config', () => {
    expect(resolveDeployBackend('cloudflare', {})).toBe('neon')
  })
})

describe('planDeployBackends', () => {
  it('resolves each target from its own env and flags a Neon schema need', () => {
    const env = { cloudflare: { CLOUDFLARE_D1_DATABASE: 'app-db' }, vercel: {} }
    const { backends, needsNeonSchema } = planDeployBackends(['vercel', 'cloudflare'], target => env[target])
    expect(backends.get('vercel')).toBe('neon')
    expect(backends.get('cloudflare')).toBe('d1')
    expect(needsNeonSchema).toBe(true)
  })

  it('does not request the Neon schema when every target is D1', () => {
    const env = { cloudflare: { CLOUDFLARE_D1_DATABASE: 'app-db' } }
    const { needsNeonSchema } = planDeployBackends(['cloudflare'], target => env[target])
    expect(needsNeonSchema).toBe(false)
  })

  it('treats a target with no resolver as an empty env', () => {
    const { backends, needsNeonSchema } = planDeployBackends(['cloudflare'])
    expect(backends.get('cloudflare')).toBe('neon')
    expect(needsNeonSchema).toBe(true)
  })
})
