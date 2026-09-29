import { getDb } from './db'

/**
 * Run a single engine-agnostic query against the shared connection. Callers
 * that need several statements to run atomically must use `Db.transaction`
 * with its injected query instead of calling this repeatedly.
 */
export function runQuery<T>(sql: string, params: unknown[] = []) {
  return getDb().then(db => db.query<T>(sql, params))
}
