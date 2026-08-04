import { Pool } from 'pg'
import type { Db, DbResult } from './db-types'

let pool: Pool | null = null

function getPool() {
  if (pool) return pool

  const databaseURL = (process.env.DATABASE_URL || '').trim()
  if (!databaseURL) {
    throw new Error('Missing DATABASE_URL for database access')
  }

  const schemaName = (process.env.SCHEMA_NAME || '').trim()

  pool = new Pool({
    connectionString: databaseURL,
    max: 10,
  })

  if (schemaName) {
    pool.on('connect', (client) => {
      client.query(`set search_path to "${schemaName}"`)
    })
  }

  return pool
}

export function createPgDb(): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<DbResult<T>> {
      const result = await getPool().query(sql, params)
      return { rows: result.rows as T[], rowCount: result.rowCount }
    },
    async close() {
      if (!pool) return
      await pool.end()
      pool = null
    },
  }
}
