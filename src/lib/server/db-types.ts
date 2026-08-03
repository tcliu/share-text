export interface DbResult<T> {
  rows: T[]
  rowCount: number | null
}

export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<DbResult<T>>
  close(): Promise<void>
}
