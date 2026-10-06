// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const neonMocks = vi.hoisted(() => {
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    listeners: new Map<string, (client: unknown) => void>(),
  }
  const Pool = vi.fn(function Pool() {
    return pool
  })
  return { pool, Pool }
})

vi.mock('@neondatabase/serverless', () => ({
  Pool: neonMocks.Pool,
}))

const ORIGINAL_ENV = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('$lib/server/db/neon')
}

beforeEach(() => {
  vi.clearAllMocks()
  neonMocks.pool.listeners.clear()
  neonMocks.pool.on.mockImplementation((event: string, listener: (client: unknown) => void) => {
    neonMocks.pool.listeners.set(event, listener)
    return neonMocks.pool
  })
  neonMocks.pool.query.mockResolvedValue({ rows: [], rowCount: 0 })
  neonMocks.pool.end.mockResolvedValue(undefined)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('createNeonDb', () => {
  it('rejects when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    await expect(db.query('select 1')).rejects.toThrow('Missing DATABASE_URL for database access')
    expect(neonMocks.Pool).not.toHaveBeenCalled()
  })

  it('binds parameters through the pool and maps the result', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    neonMocks.pool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    const result = await db.query<{ id: number }>('select id from documents where key = $1', ['a1b2c3'])

    expect(neonMocks.pool.query).toHaveBeenCalledWith('select id from documents where key = $1', ['a1b2c3'])
    expect(result).toEqual({ rows: [{ id: 1 }], rowCount: 1 })
  })

  it('defaults to an empty parameter list when none is given', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const { createNeonDb } = await importFresh()
    await createNeonDb().query('select 1')

    expect(neonMocks.pool.query).toHaveBeenCalledWith('select 1', [])
  })

  it('quotes SCHEMA_NAME when setting the connection search_path', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    process.env.SCHEMA_NAME = 'my "quoted" schema'
    const { createNeonDb } = await importFresh()
    await createNeonDb().query('select 1')

    expect(neonMocks.pool.on).toHaveBeenCalledWith('connect', expect.any(Function))
    const listener = neonMocks.pool.listeners.get('connect')
    expect(listener).toBeDefined()

    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
    listener!(client)

    expect(client.query).toHaveBeenCalledWith('set search_path to "my ""quoted"" schema"')
  })

  it('logs and swallows a failed search_path assignment', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    process.env.SCHEMA_NAME = 'app_schema'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { createNeonDb } = await importFresh()
    await createNeonDb().query('select 1')

    const client = { query: vi.fn().mockRejectedValue(new Error('permission denied')) }
    neonMocks.pool.listeners.get('connect')!(client)
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())

    expect(consoleError).toHaveBeenCalledWith('Failed to set search_path on Neon connection', {
      error: expect.any(Error),
    })
    consoleError.mockRestore()
  })

  it('does not register a search_path hook when SCHEMA_NAME is unset', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const { createNeonDb } = await importFresh()
    await createNeonDb().query('select 1')

    expect(neonMocks.pool.on).not.toHaveBeenCalled()
  })

  it('commits a transaction and releases the client', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }
    neonMocks.pool.connect.mockResolvedValue(client)
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    const result = await db.transaction(async query => {
      await query('insert into documents (key) values ($1)', ['a1b2c3'])
      return 'done'
    })

    expect(result).toBe('done')
    expect(client.query).toHaveBeenNthCalledWith(1, 'begin')
    expect(client.query).toHaveBeenNthCalledWith(2, 'insert into documents (key) values ($1)', ['a1b2c3'])
    expect(client.query).toHaveBeenNthCalledWith(3, 'commit')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rolls back and rethrows when the transaction body fails', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'insert') throw new Error('insert failed')
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    neonMocks.pool.connect.mockResolvedValue(client)
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    await expect(db.transaction(async query => query('insert'))).rejects.toThrow('insert failed')

    expect(client.query).toHaveBeenCalledWith('rollback')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('survives a rollback failure and still throws the original error', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'boom') throw new Error('original')
        if (sql === 'rollback') throw new Error('rollback failed')
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    neonMocks.pool.connect.mockResolvedValue(client)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    await expect(db.transaction(async query => query('boom'))).rejects.toThrow('original')

    expect(client.release).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('closes the pool and is a no-op when never opened', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db'
    delete process.env.SCHEMA_NAME
    const { createNeonDb } = await importFresh()
    const db = createNeonDb()

    await db.close()
    expect(neonMocks.pool.end).not.toHaveBeenCalled()

    await db.query('select 1')
    await db.close()
    expect(neonMocks.pool.end).toHaveBeenCalledOnce()
  })
})
