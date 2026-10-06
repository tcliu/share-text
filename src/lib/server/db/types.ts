export interface DbResult<T> {
  rows: T[]
  rowCount: number | null
}

export type DbQuery = <T>(sql: string, params?: unknown[]) => Promise<DbResult<T>>

// One statement in a `Db.batch` call. `batch` runs the list atomically on every
// backend, so multi-statement writes that must not partially apply use it
// instead of a sequence of `query` calls.
export interface DbStatement {
  sql: string
  params?: unknown[]
}

export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<DbResult<T>>
  batch(statements: DbStatement[]): Promise<DbResult<unknown>[]>
  transaction<T>(fn: (query: DbQuery) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export type DbKind = 'sqlite' | 'neon' | 'd1'
