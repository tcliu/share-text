// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createD1Db, isD1Database, type D1DatabaseLike } from '$lib/server/db/d1'
import { resolveDbConfig } from '$lib/server/db'
import { D1_BINDING_NAME } from '$lib/d1-binding.mjs'

interface RecordedStatement {
  sql: string
  params: unknown[]
}

// Minimal D1 binding double: records prepared statements and returns configured
// outcomes. `batch` returns one outcome per configured `batch` entry.
function fakeD1(
  options: {
    results?: unknown[]
    changes?: number
    batch?: Array<{ results?: unknown[]; changes?: number | null }>
  } = {},
) {
  const ran: RecordedStatement[] = []
  const batched: RecordedStatement[][] = []
  const database = {
    prepare(sql: string) {
      let params: unknown[] = []
      const statement = {
        sql,
        get params() {
          return params
        },
        bind(...next: unknown[]) {
          params = next
          return statement
        },
        async all() {
          ran.push({ sql, params })
          return { results: options.results ?? [] }
        },
        async run() {
          ran.push({ sql, params })
          return { meta: { changes: options.changes ?? 1 } }
        },
      }
      return statement
    },
    async batch(statements: Array<{ sql: string; params: unknown[] }>) {
      batched.push(statements.map(statement => ({ sql: statement.sql, params: statement.params })))
      return (options.batch ?? []).map(entry => ({ results: entry.results, meta: { changes: entry.changes ?? null } }))
    },
  }
  return { database: database as unknown as D1DatabaseLike, ran, batched }
}

describe('D1 adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rewrites $n placeholders and coerces params', async () => {
    const { database, ran } = fakeD1()
    const db = createD1Db(database)
    await db.query('select id from t where id = $1 and flag = $2', [7, true])
    expect(ran[0].sql).toBe('select id from t where id = ? and flag = ?')
    expect(ran[0].params).toEqual([7, 1])
  })

  it('stores current_timestamp as the shared ISO expression', async () => {
    const { database, ran } = fakeD1()
    const db = createD1Db(database)
    await db.query('update t set updated_at = current_timestamp where id = $1', [1])
    expect(ran[0].sql).toContain("strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  })

  it('returns rows for a select', async () => {
    const { database } = fakeD1({ results: [{ id: 1 }] })
    const db = createD1Db(database)
    const result = await db.query<{ id: number }>('select id from t')
    expect(result.rows).toEqual([{ id: 1 }])
    expect(result.rowCount).toBe(1)
  })

  it('returns the change count for a write', async () => {
    const { database } = fakeD1({ changes: 3 })
    const db = createD1Db(database)
    const result = await db.query('delete from t where id = $1', [1])
    expect(result.rows).toEqual([])
    expect(result.rowCount).toBe(3)
  })

  it('runs a batch and reports per-statement results', async () => {
    const { database, batched } = fakeD1({
      batch: [{ changes: 0 }, { results: [{ id: 9 }], changes: 1 }, { changes: 1 }],
    })
    const db = createD1Db(database)
    const results = await db.batch([
      { sql: 'delete from shares where id = $1', params: [1] },
      { sql: 'update docs set name = $1 where id = $2 returning id', params: ['n', 2] },
      { sql: 'delete from docs where id = $1', params: [2] },
    ])
    expect(batched).toHaveLength(1)
    expect(batched[0].map(statement => statement.sql)).toEqual([
      'delete from shares where id = ?',
      'update docs set name = ? where id = ? returning id',
      'delete from docs where id = ?',
    ])
    expect(results.map(result => result.rowCount)).toEqual([0, 1, 1])
    expect(results[1].rows).toEqual([{ id: 9 }])
  })

  it('falls back to sequential execution when the binding has no batch', async () => {
    const { database, ran } = fakeD1({ changes: 2 })
    delete (database as { batch?: unknown }).batch
    const db = createD1Db(database)
    const results = await db.batch([
      { sql: 'delete from a where id = $1', params: [1] },
      { sql: 'delete from b where id = $1', params: [1] },
    ])
    expect(ran.map(statement => statement.sql)).toEqual(['delete from a where id = ?', 'delete from b where id = ?'])
    expect(results.map(result => result.rowCount)).toEqual([2, 2])
  })

  it('logs a warning when a transaction runs more than one statement', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { database } = fakeD1()
    const db = createD1Db(database)
    await db.transaction(async query => {
      await query('delete from a where id = $1', [1])
      await query('delete from b where id = $1', [1])
    })
    expect(log.mock.calls.some(call => String(call[0]).includes('action=d1_transaction_nonatomic'))).toBe(true)
  })

  it('does not warn for a single-statement transaction', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { database } = fakeD1()
    const db = createD1Db(database)
    await db.transaction(async query => {
      await query('delete from a where id = $1', [1])
    })
    expect(log.mock.calls.some(call => String(call[0]).includes('d1_transaction_nonatomic'))).toBe(false)
  })
})

describe('resolveDbConfig', () => {
  it('selects D1 for a prod profile with a reachable binding and no DATABASE_URL', async () => {
    const { database } = fakeD1()
    const config = await resolveDbConfig({
      PROFILE: 'prod',
      [D1_BINDING_NAME]: database,
    } as unknown as NodeJS.ProcessEnv)
    expect(config.kind).toBe('d1')
  })

  it('selects Neon when DATABASE_URL is set, even with a binding', async () => {
    const { database } = fakeD1()
    const config = await resolveDbConfig({
      PROFILE: 'prod',
      DATABASE_URL: 'postgres://db',
      [D1_BINDING_NAME]: database,
    } as unknown as NodeJS.ProcessEnv)
    expect(config.kind).toBe('neon')
  })

  it('selects Neon for prod with no binding', async () => {
    expect((await resolveDbConfig({ PROFILE: 'prod' } as unknown as NodeJS.ProcessEnv)).kind).toBe('neon')
  })

  it('selects dev SQLite for a dev profile', async () => {
    expect((await resolveDbConfig({ PROFILE: 'dev' } as unknown as NodeJS.ProcessEnv)).kind).toBe('sqlite')
  })

  it('falls back to Neon on a Cloudflare runtime when no binding resolves', async () => {
    // `cloudflare:workers` is absent off-Workers; the probe must degrade to Neon.
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect((await resolveDbConfig({ PROFILE: 'prod', CF_PAGES: '1' } as unknown as NodeJS.ProcessEnv)).kind).toBe(
      'neon',
    )
  })
})

describe('D1 binding contract', () => {
  it('names the binding DB so the deploy and runtime halves agree', () => {
    expect(D1_BINDING_NAME).toBe('DB')
  })

  it('recognizes a database-like binding and rejects others', () => {
    expect(isD1Database(fakeD1().database)).toBe(true)
    expect(isD1Database('nope')).toBe(false)
  })
})
