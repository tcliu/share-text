import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  desiredWorkerVars,
  ensureD1Database,
  fetchWorkersSubdomain,
  findD1DatabaseId,
  generatedWranglerProjectName,
  listWorkerScripts,
  renderWranglerConfig,
  resolveCloudflareAppUrl,
  resolveCloudflareProjectName,
  resolveD1DatabaseName,
  splitCloudflareEnv,
  workerExists,
  workersHost,
} from './cloudflare.mjs'

function jsonFetch(payload, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })
}

describe('listWorkerScripts', () => {
  it('returns the script list', async () => {
    const fetchImpl = jsonFetch({ success: true, result: [{ id: 'app' }, { id: 'other' }] })
    expect(await listWorkerScripts({ accountId: 'acct', token: 'tok', fetchImpl })).toEqual([
      { id: 'app' },
      { id: 'other' },
    ])
  })

  it('treats a non-array result as empty', async () => {
    const fetchImpl = jsonFetch({ success: true, result: null })
    expect(await listWorkerScripts({ accountId: 'acct', token: 'tok', fetchImpl })).toEqual([])
  })

  it('throws on an API error so the auth step fails loudly', async () => {
    const fetchImpl = jsonFetch({ success: false, errors: [{ message: 'Authentication error' }] }, 403)
    await expect(listWorkerScripts({ accountId: 'acct', token: 'tok', fetchImpl })).rejects.toThrow(
      'Cloudflare API 403: Authentication error',
    )
  })
})

describe('workerExists', () => {
  it('matches the script id exactly, never by prefix', async () => {
    const fetchImpl = jsonFetch({ success: true, result: [{ id: 'sample-app' }, { id: 'sample-app-v2' }] })
    expect(await workerExists('sample-app', { accountId: 'a', token: 't', fetchImpl })).toBe(true)
    expect(await workerExists('sample-app-v', { accountId: 'a', token: 't', fetchImpl })).toBe(false)
  })
})

describe('fetchWorkersSubdomain', () => {
  it('returns the account subdomain and empty when unset', async () => {
    expect(
      await fetchWorkersSubdomain({
        accountId: 'a',
        token: 't',
        fetchImpl: jsonFetch({ success: true, result: { subdomain: 'team' } }),
      }),
    ).toBe('team')
    expect(
      await fetchWorkersSubdomain({
        accountId: 'a',
        token: 't',
        fetchImpl: jsonFetch({ success: true, result: {} }),
      }),
    ).toBe('')
  })
})

describe('workersHost', () => {
  it('builds the Workers.dev hostname only from both parts', () => {
    expect(workersHost('sample-app', 'team')).toBe('sample-app.team.workers.dev')
    expect(workersHost('', 'team')).toBe('')
    expect(workersHost('sample-app', '')).toBe('')
  })
})

describe('resolveCloudflareProjectName', () => {
  it('prefers the overlay key over the generated file', () => {
    expect(resolveCloudflareProjectName({ CLOUDFLARE_PROJECT: 'sample-project' }, 'sample-app')).toBe(
      'sample-project',
    )
  })

  it('falls back to the generated name', () => {
    expect(resolveCloudflareProjectName({}, 'sample-app')).toBe('sample-app')
  })

  it('returns empty when neither is set', () => {
    expect(resolveCloudflareProjectName({}, '')).toBe('')
  })
})

describe('generatedWranglerProjectName', () => {
  it('reads the name from the generated config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wrangler-name-'))
    writeFileSync(join(dir, 'wrangler.toml'), 'name = "my-app"\n[vars]\n')
    expect(generatedWranglerProjectName(dir)).toBe('my-app')
  })

  it('returns empty without a config', () => {
    expect(generatedWranglerProjectName(mkdtempSync(join(tmpdir(), 'wrangler-empty-')))).toBe('')
  })
})

describe('resolveCloudflareAppUrl', () => {
  it('derives the live URL from the Workers.dev host', async () => {
    expect(
      await resolveCloudflareAppUrl({
        env: { CLOUDFLARE_PROJECT: 'sample-app', CLOUDFLARE_ACCOUNT_ID: 'acct', CLOUDFLARE_API_TOKEN: 'tok' },
        fetchImpl: jsonFetch({ success: true, result: { subdomain: 'team' } }),
      }),
    ).toBe('https://sample-app.team.workers.dev')
  })

  it('falls back to APP_BASE_URL when the subdomain is unavailable', async () => {
    expect(
      await resolveCloudflareAppUrl({
        env: { CLOUDFLARE_PROJECT: 'sample-app', APP_BASE_URL: 'https://app.example.com/' },
        fetchImpl: async () => {
          throw new Error('offline')
        },
      }),
    ).toBe('https://app.example.com')
  })

  it('throws when the Worker name is missing', async () => {
    await expect(
      resolveCloudflareAppUrl({
        env: {},
        root: mkdtempSync(join(tmpdir(), 'wrangler-noproj-')),
        fetchImpl: jsonFetch({ success: true, result: { subdomain: 'team' } }),
      }),
    ).rejects.toThrow('Missing CLOUDFLARE_PROJECT')
  })

  it('throws when neither the host nor APP_BASE_URL resolves', async () => {
    await expect(
      resolveCloudflareAppUrl({
        env: { CLOUDFLARE_PROJECT: 'missing', CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' },
        fetchImpl: jsonFetch({ success: false, errors: [{ message: 'Authentication error' }] }, 403),
      }),
    ).rejects.toThrow('Could not resolve the Workers.dev host for missing')
  })
})

describe('renderWranglerConfig', () => {
  it('renders name + Workers stanza + pruned vars', () => {
    expect(renderWranglerConfig({ project: 'sample-project', vars: { ADMIN_USERNAME: 'admin' } })).toBe(
      [
        'name = "sample-project"',
        'compatibility_date = "2026-09-01"',
        'compatibility_flags = ["nodejs_compat"]',
        '',
        '[vars]',
        'ADMIN_USERNAME = "admin"',
        '',
      ].join('\n'),
    )
  })

  it('never emits the retired Pages build setting', () => {
    expect(renderWranglerConfig({ project: 'x', vars: {} })).not.toContain('pages_build_output_dir')
  })
})

describe('desiredWorkerVars', () => {
  it('appends the forced build vars', () => {
    expect(desiredWorkerVars({ ADMIN_USERNAME: 'admin' })).toEqual({
      ADMIN_USERNAME: 'admin',
      CF_WORKER: '1',
      PROFILE: 'prod',
    })
  })

  it('forces CF_WORKER and PROFILE even when the overlay disagrees', () => {
    expect(desiredWorkerVars({ CF_WORKER: '0', PROFILE: 'dev' })).toEqual({
      CF_WORKER: '1',
      PROFILE: 'prod',
    })
  })
})

describe('splitCloudflareEnv', () => {
  it('splits vars, secrets, and local-only keys; drops empties and forbidden keys', () => {
    expect(
      splitCloudflareEnv({
        CLOUDFLARE_PROJECT: 'sample-project',
        APP_BASE_URL: 'https://x.pages.dev',
        ADMIN_USERNAME: 'admin',
        EMPTY: '',
        DATABASE_URL: 'postgres://x',
        VERCEL_TOKEN: 'v',
        CRON_SECRET: 's',
        CLOUDFLARE_SCAN_TOKEN: 't',
      }),
    ).toEqual({
      project: 'sample-project',
      vars: { ADMIN_USERNAME: 'admin' },
      secrets: { CRON_SECRET: 's', CLOUDFLARE_SCAN_TOKEN: 't' },
    })
  })

  it('returns an empty project when the overlay key is missing', () => {
    expect(splitCloudflareEnv({ ADMIN_USERNAME: 'admin' }).project).toBe('')
  })

  it('accepts a narrower forbidden set for Neon-backed apps', () => {
    const vercelOnly = new Set(['VERCEL_TOKEN'])
    expect(
      splitCloudflareEnv({ DATABASE_URL: 'postgres://x', VERCEL_TOKEN: 'v' }, { forbidden: vercelOnly }),
    ).toEqual({ project: '', vars: {}, secrets: { DATABASE_URL: 'postgres://x' } })
  })
})

describe('renderWranglerConfig with D1', () => {
  it('appends a D1 binding when provided', () => {
    const config = renderWranglerConfig({
      project: 'my-app',
      vars: { PROFILE: 'prod' },
      d1: { binding: 'MY_APP_D1', databaseName: 'my-app-d1', databaseId: 'abc-123' },
    })
    expect(config).toContain('[vars]')
    expect(config).toContain('[[d1_databases]]')
    expect(config).toContain('binding = "MY_APP_D1"')
    expect(config).toContain('database_name = "my-app-d1"')
    expect(config).toContain('database_id = "abc-123"')
  })

  it('omits the D1 block without a database', () => {
    expect(renderWranglerConfig({ project: 'x', vars: {} })).not.toContain('d1_databases')
  })

  it('fails closed on a partial D1 descriptor', () => {
    expect(() => renderWranglerConfig({ project: 'x', vars: {}, d1: { databaseName: 'd', databaseId: 'i' } }))
      .toThrow('d1.binding is required')
    expect(() => renderWranglerConfig({ project: 'x', vars: {}, d1: { binding: 'B' } }))
      .toThrow('d1.databaseName is required')
  })
})

describe('resolveD1DatabaseName', () => {
  it('prefers the overlay value and returns empty when unset', () => {
    expect(resolveD1DatabaseName({ CLOUDFLARE_D1_DATABASE: 'custom-d1' })).toBe('custom-d1')
    expect(resolveD1DatabaseName({})).toBe('')
  })
})

describe('findD1DatabaseId', () => {
  const d1List = JSON.stringify([
    { uuid: 'id-1', name: 'my-app-d1' },
    { database_id: 'id-2', name: 'other-d1' },
  ])

  it('accepts uuid and database_id fields', () => {
    expect(findD1DatabaseId(d1List, 'my-app-d1')).toBe('id-1')
    expect(findD1DatabaseId(d1List, 'other-d1')).toBe('id-2')
    expect(findD1DatabaseId(d1List, 'missing-d1')).toBe('')
    expect(findD1DatabaseId('not json', 'my-app-d1')).toBe('')
  })
})

describe('ensureD1Database', () => {
  const d1List = JSON.stringify([{ uuid: 'id-1', name: 'my-app-d1' }])

  it('returns the existing id without creating', () => {
    const calls = []
    const runner = args => {
      calls.push(args.join(' '))
      return { status: 0, output: d1List }
    }
    expect(ensureD1Database('my-app-d1', runner)).toEqual({ status: 'exists', databaseId: 'id-1' })
    expect(calls).toEqual(['d1 list --json'])
  })

  it('creates and re-lists when missing', () => {
    const calls = []
    let listed = 0
    const runner = args => {
      calls.push(args.join(' '))
      if (args.includes('create')) {
        return { status: 0, output: '' }
      }
      listed += 1
      return { status: 0, output: listed === 1 ? '[]' : d1List }
    }
    expect(ensureD1Database('my-app-d1', runner)).toEqual({ status: 'created', databaseId: 'id-1' })
    expect(calls).toEqual(['d1 list --json', 'd1 create my-app-d1', 'd1 list --json'])
  })

  it('throws when listing fails', () => {
    const runner = () => ({ status: 1, output: '' })
    expect(() => ensureD1Database('my-app-d1', runner)).toThrow('d1 list failed')
  })
})

describe('CLOUDFLARE_SECRET_KEYS', () => {
  // The set is built from the shared defaults plus the app's own credential
  // names, read from `secretKeys` in the ungated `deploy.config.json`. The
  // config is a module-level read, so the module is re-imported against a
  // mocked config to observe the union.
  async function loadWithConfig(secretKeys) {
    vi.resetModules()
    vi.doMock('../deploy.config.mjs', () => ({ secretKeys }))
    return import('./cloudflare.mjs')
  }

  afterEach(() => {
    vi.doUnmock('../deploy.config.mjs')
    vi.resetModules()
  })

  it('keeps the shared credential defaults when the app configures none', async () => {
    const { CLOUDFLARE_SECRET_KEYS } = await loadWithConfig(undefined)
    expect(CLOUDFLARE_SECRET_KEYS.has('SESSION_SECRET')).toBe(true)
    expect(CLOUDFLARE_SECRET_KEYS.has('CRON_SECRET')).toBe(true)
  })

  it("adds an app's configured credential names to the shared defaults", async () => {
    const { CLOUDFLARE_SECRET_KEYS } = await loadWithConfig(['APP_TOKEN'])
    expect(CLOUDFLARE_SECRET_KEYS.has('APP_TOKEN')).toBe(true)
    expect(CLOUDFLARE_SECRET_KEYS.has('SESSION_SECRET')).toBe(true)
  })

  it('routes a configured credential name to the secret store, not to plain vars', async () => {
    const { splitCloudflareEnv } = await loadWithConfig(['APP_TOKEN'])
    const { vars, secrets } = splitCloudflareEnv({ APP_TOKEN: 'token-value', SESSION_SECRET: 'secret-value', PLAIN: 'plain-value' })
    expect(secrets.APP_TOKEN).toBe('token-value')
    expect(vars.APP_TOKEN).toBeUndefined()
    expect(secrets.SESSION_SECRET).toBe('secret-value')
    expect(vars.PLAIN).toBe('plain-value')
  })

  it('ignores a malformed secretKeys value instead of failing the import', async () => {
    const { CLOUDFLARE_SECRET_KEYS } = await loadWithConfig('not-an-array')
    expect(CLOUDFLARE_SECRET_KEYS.has('SESSION_SECRET')).toBe(true)
    expect(CLOUDFLARE_SECRET_KEYS.has('not-an-array')).toBe(false)
  })
})
