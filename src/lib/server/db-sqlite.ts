import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SQLInputValue } from 'node:sqlite'
import type { Db, DbResult } from './db-types'

export const DEFAULT_SQLITE_PATH = '.data/share-text-dev.sqlite'

function isRowsReturningSql(sql: string) {
  return /^\s*(select|with\b)/i.test(sql) || /returning\b/i.test(sql)
}

export function toSqliteSql(sql: string) {
  return sql
    .replace(/\$\d+/g, () => '?')
    .replaceAll('bigserial', 'integer')
    .replaceAll('current_timestamp', "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
}

export async function readSchemaSql() {
  const schemaUrl = new URL('../../../sql/schema.sql', import.meta.url)
  return readFile(fileURLToPath(schemaUrl), 'utf8')
}

export async function createSqliteDb(path = process.env.SQLITE_PATH || DEFAULT_SQLITE_PATH): Promise<Db> {
  const { DatabaseSync } = await import('node:sqlite')

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const database = new DatabaseSync(path)
  const schema = await readSchemaSql()
  database.exec(toSqliteSql(schema))

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<DbResult<T>> {
      const statement = database.prepare(toSqliteSql(sql))
      const args = params as SQLInputValue[]
      if (isRowsReturningSql(sql)) {
        const rows = statement.all(...args)
        return { rows: rows as T[], rowCount: rows.length }
      }
      const result = statement.run(...args)
      return { rows: [], rowCount: Number(result.changes) }
    },
    async close() {
      database.close()
    },
  }
}
