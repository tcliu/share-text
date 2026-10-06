// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { preflightDeploy, targetAvailability } from './preflight.mjs'

// A fixture root the preflight reads instead of the repo root. `.env.local`
// and the Vercel link live under it, so tests never touch the real checkout.
function fixture(files = {}, { link = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'deploy-preflight-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content)
  }
  if (link) {
    mkdirSync(join(root, '.vercel'))
    writeFileSync(join(root, '.vercel', 'project.json'), '{"projectName":"demo"}')
  }
  return root
}

describe('preflightDeploy', () => {
  beforeEach(() => {
    // The operator merge reads shell env: keep it out of the fixtures.
    vi.stubEnv('VERCEL_PROJECT', '')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '')
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('passes when every required vercel prop is in .env.vercel', () => {
    const root = fixture({ '.env.vercel': 'APP_BASE_URL=x\nDATABASE_URL=y\n' }, { link: true })
    expect(() =>
      preflightDeploy({ target: 'vercel', requiredEnv: { vercel: ['APP_BASE_URL', 'DATABASE_URL'] }, root }),
    ).not.toThrow()
  })

  it('reports a prop missing from the push universe', () => {
    const root = fixture({ '.env.vercel': 'APP_BASE_URL=x\n' }, { link: true })
    expect(() =>
      preflightDeploy({ target: 'vercel', requiredEnv: { vercel: ['APP_BASE_URL', 'SESSION_SECRET'] }, root }),
    ).toThrow(/SESSION_SECRET/)
  })

  it('satisfies an A|B group when any one key is present', () => {
    const root = fixture({ '.env.vercel': 'ADMIN_PASSWORD_HASH=h\n' }, { link: true })
    expect(() =>
      preflightDeploy({
        target: 'vercel',
        requiredEnv: { vercel: ['ADMIN_PASSWORD|ADMIN_PASSWORD_HASH'] },
        root,
      }),
    ).not.toThrow()
  })

  it('ignores .env.prod for a vercel prop (outside the push universe)', () => {
    const root = fixture({ '.env.prod': 'SESSION_SECRET=from-prod\n' }, { link: true })
    expect(() => preflightDeploy({ target: 'vercel', requiredEnv: { vercel: ['SESSION_SECRET'] }, root })).toThrow(
      /SESSION_SECRET/,
    )
  })

  it('requires a vercel link when neither the link nor VERCEL_PROJECT is present', () => {
    expect(() => preflightDeploy({ target: 'vercel', root: fixture() })).toThrow(/vercel link/)
  })

  it('accepts a --project flag as the link intent', () => {
    expect(() => preflightDeploy({ target: 'vercel', projectFlag: 'my-app', root: fixture() })).not.toThrow()
  })

  it('accepts VERCEL_PROJECT from .env.vercel when unlinked', () => {
    const root = fixture({ '.env.vercel': 'VERCEL_PROJECT=from-file\n' })
    expect(() => preflightDeploy({ target: 'vercel', root })).not.toThrow()
  })

  it('accepts VERCEL_PROJECT from a non-synced layer (.env.prod)', () => {
    const root = fixture({ '.env.prod': 'VERCEL_PROJECT=from-prod\n' })
    expect(() => preflightDeploy({ target: 'vercel', root })).not.toThrow()
  })

  it('requires CLOUDFLARE_API_TOKEN for a cloudflare deploy', () => {
    const root = fixture({ '.env.prod': 'DATABASE_URL=y\n' })
    expect(() =>
      preflightDeploy({ target: 'cloudflare', requiredEnv: { cloudflare: ['DATABASE_URL'] }, root }),
    ).toThrow(/CLOUDFLARE_API_TOKEN/)
  })

  it('ignores a Cloudflare token placed in a synced file', () => {
    const root = fixture({ '.env.prod': 'CLOUDFLARE_API_TOKEN=leaked\n' })
    expect(() => preflightDeploy({ target: 'cloudflare', root })).toThrow(/CLOUDFLARE_API_TOKEN/)
  })

  it('requires CLOUDFLARE_ACCOUNT_ID for a cloudflare deploy', () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'tok')
    const root = fixture({ '.env.prod': 'DATABASE_URL=y\n' })
    expect(() =>
      preflightDeploy({ target: 'cloudflare', requiredEnv: { cloudflare: ['DATABASE_URL'] }, root }),
    ).toThrow(/CLOUDFLARE_ACCOUNT_ID/)
  })

  it('accepts CLOUDFLARE_ACCOUNT_ID from the synced .env.cloudflare', () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'tok')
    const root = fixture({ '.env.cloudflare': 'CLOUDFLARE_ACCOUNT_ID=acct\n' })
    expect(() => preflightDeploy({ target: 'cloudflare', root })).not.toThrow()
  })

  it('passes a cloudflare deploy when the token and props resolve', () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'tok')
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct')
    const root = fixture({ '.env.prod': 'DATABASE_URL=y\n', '.env.cloudflare': 'CLOUDFLARE_PROJECT=demo\n' })
    expect(() =>
      preflightDeploy({
        target: 'cloudflare',
        requiredEnv: { cloudflare: ['CLOUDFLARE_PROJECT', 'DATABASE_URL|CLOUDFLARE_D1_DATABASE'] },
        root,
      }),
    ).not.toThrow()
  })

  it('rejects an unknown target', () => {
    expect(() => preflightDeploy({ target: 'nope', root: fixture() })).toThrow(/Unknown deploy target/)
  })
})

describe('target availability', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_PROJECT', '')
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '')
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function available(options = {}) {
    return targetAvailability(options)
      .filter(entry => entry.available)
      .map(entry => entry.value)
  }

  it('offers vercel on an interactive run that can link', () => {
    expect(available({ root: fixture(), interactive: true, linkTargets: ['vercel'] })).toContain('vercel')
  })

  it('hides vercel interactively when no link plugin is selected', () => {
    expect(available({ root: fixture(), interactive: true })).not.toContain('vercel')
  })

  it('hides vercel non-interactively when unlinked', () => {
    expect(available({ root: fixture(), interactive: false })).not.toContain('vercel')
  })

  it('requires the cloudflare token', () => {
    const root = fixture({ '.env.cloudflare': 'CLOUDFLARE_PROJECT=demo\n' })
    expect(available({ root, interactive: true, linkTargets: ['vercel'] })).toEqual(['vercel'])
  })

  it('reports the missing config per target', () => {
    const availability = targetAvailability({ root: fixture(), interactive: false })
    const vercel = availability.find(entry => entry.value === 'vercel')
    expect(vercel.available).toBe(false)
    expect(vercel.missing.join(' ')).toMatch(/vercel link/)
  })
})
