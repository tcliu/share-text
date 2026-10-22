import type { Db, DbQuery, DbResult, DbStatement } from './types'
import { isRowsReturningSql, toSqliteSql } from '../sql-rewrite.mjs'
import { logEvent } from '../logging'

// Cloudflare D1 provider (optional production backend; selected when the D1
// binding is present and no DATABASE_URL is configured). D1 has no interactive
// transactions, so `transaction` is not atomic: it runs the statements in order
// and logs a warning when more than one ran, so the degradation is observable.
// Writes that must not partially apply use `batch` (D1 executes a batch as one
// atomic transaction).
export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement
  all(): Promise<{ results?: unknown[] }>
  run(): Promise<{ meta?: { changes?: number | null } }>
}

export interface D1BatchResult {
  results?: unknown[]
  meta?: { changes?: number | null }
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatement
  batch?(statements: D1PreparedStatement[]): Promise<D1BatchResult[]>
}

export function isD1Database(value: unknown): value is D1DatabaseLike {
  return Boolean(value) && typeof (value as D1DatabaseLike).prepare === 'function'
}

function toD1Param(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value === undefined) {
    return null
  }
  return value
}

// Reuse the shared token rewrite so D1 handles `$n` placeholder substitution and
// stores the same ISO `current_timestamp` as the dev SQLite adapter (a raw
// `current_timestamp` would store SQLite's native `YYYY-MM-DD HH:MM:SS` form and
// diverge from dev). D1/SQLite supports the `strftime` expression, and the
// rewrite already skips quoted strings and comments.
function toD1Query(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  const text = toSqliteSql(sql).replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
  return { text, values: params.map(toD1Param) }
}

export function createD1Db(database: D1DatabaseLike): Db {
  async function run<T>(sql: string, params: unknown[] = []): Promise<DbResult<T>> {
    const { text, values } = toD1Query(sql, params)
    if (isRowsReturningSql(sql)) {
      const outcome = await database
        .prepare(text)
        .bind(...values)
        .all()
      const rows = (outcome.results ?? []) as T[]
      return { rows, rowCount: rows.length }
    }
    const outcome = await database
      .prepare(text)
      .bind(...values)
      .run()
    return { rows: [], rowCount: outcome.meta?.changes ?? null }
  }

  function prepare(sql: string, params: unknown[] = []) {
    const { text, values } = toD1Query(sql, params)
    return database.prepare(text).bind(...values)
  }

  return {
    query: run,
    async batch(statements: DbStatement[]): Promise<DbResult<unknown>[]> {
      if (statements.length === 0) {
        return []
      }
      if (typeof database.batch !== 'function') {
        // A binding without `batch` cannot run atomically; fall back to a
        // sequential run so the statement set still executes.
        const results: DbResult<unknown>[] = []
        for (const statement of statements) {
          results.push(await run(statement.sql, statement.params ?? []))
        }
        return results
      }
      const outcomes = await database.batch(statements.map(statement => prepare(statement.sql, statement.params ?? [])))
      return outcomes.map((outcome, index) => {
        const rows = (outcome.results ?? []) as unknown[]
        return {
          rows,
          rowCount: isRowsReturningSql(statements[index].sql) ? rows.length : (outcome.meta?.changes ?? null),
        }
      })
    },
    async transaction<T>(fn: (query: DbQuery) => Promise<T>): Promise<T> {
      let statements = 0
      const result = await fn(async (sql, params = []) => {
        statements += 1
        return run(sql, params)
      })
      if (statements > 1) {
        logEvent({ action: 'd1_transaction_nonatomic', details: { statements, level: 'WARN' } })
      }
      return result
    },
    async close(): Promise<void> {},
  }
}
