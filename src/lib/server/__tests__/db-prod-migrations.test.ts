// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROD_MIGRATIONS } from '#lib/server/db/index.js'

const mocks = vi.hoisted(() => ({
  resolveProfile: vi.fn(),
  createNeonDb: vi.fn(),
  createSqliteDb: vi.fn(),
  logEvent: vi.fn(),
}))

vi.mock('#lib/server/profile.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/profile.js')>('#lib/server/profile.js')
  return { ...actual, resolveProfile: mocks.resolveProfile }
})

vi.mock('#lib/server/db/neon.js', () => ({ createNeonDb: mocks.createNeonDb }))
vi.mock('#lib/server/db/sqlite.js', () => ({ createSqliteDb: mocks.createSqliteDb }))

vi.mock('#lib/server/logging.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/logging.js')>('#lib/server/logging.js')
  return { ...actual, logEvent: mocks.logEvent }
})

async function importFresh() {
  vi.resetModules()
  return import('#lib/server/db/index.js')
}

const OPTIONAL_STATEMENT = PROD_MIGRATIONS.find(statement => /pg_trgm|gin_trgm_ops/i.test(statement))!

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveProfile.mockReturnValue('prod')
  mocks.createSqliteDb.mockResolvedValue({ query: vi.fn(), transaction: vi.fn(), close: vi.fn() })
})

afterEach(() => {
  vi.resetModules()
})

describe('getDb prod migration bootstrap', () => {
  it('skips an optional pg_trgm migration that the role cannot apply', async () => {
    const query = vi.fn().mockImplementation(async (statement: string) => {
      if (statement === OPTIONAL_STATEMENT) {
        throw new Error('permission denied to create extension')
      }
      return { rows: [], rowCount: 0 }
    })
    mocks.createNeonDb.mockReturnValue({ query, transaction: vi.fn(), close: vi.fn() })
    const { getDb } = await importFresh()

    const db = await getDb()

    expect(db).toBeDefined()
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'db_migration_skipped',
        details: expect.objectContaining({ statement: OPTIONAL_STATEMENT }),
      }),
    )
  })

  it('propagates a failure of a non-optional migration', async () => {
    const query = vi.fn().mockImplementation(async (statement: string) => {
      if (statement.startsWith('create table if not exists users')) {
        throw new Error('fatal migration failure')
      }
      return { rows: [], rowCount: 0 }
    })
    mocks.createNeonDb.mockReturnValue({ query, transaction: vi.fn(), close: vi.fn() })
    const { getDb } = await importFresh()

    await expect(getDb()).rejects.toThrow('fatal migration failure')
    expect(mocks.logEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'db_migration_skipped' }))
  })
})
