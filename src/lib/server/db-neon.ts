import { Pool, type PoolClient } from '@neondatabase/serverless'
import type { Db, DbQuery, DbResult } from './db-types'

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
    pool.on('connect', (client: PoolClient) => {
      client.query(`set search_path to "${schemaName}"`)
    })
  }

  return pool
}

export function createNeonDb(): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<DbResult<T>> {
      const result = await getPool().query(sql, params)
      return { rows: result.rows as T[], rowCount: result.rowCount }
    },
    async transaction<T>(fn: (query: DbQuery) => Promise<T>): Promise<T> {
      const client = await getPool().connect()
      try {
        await client.query('begin')
        const result = await fn(async <R>(sql: string, params: unknown[] = []) => {
          const res = await client.query(sql, params)
          return { rows: res.rows as R[], rowCount: res.rowCount }
        })
        await client.query('commit')
        return result
      } catch (error) {
        await client.query('rollback').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
    async close() {
      if (!pool) return
      await pool.end()
      pool = null
    },
  }
}
