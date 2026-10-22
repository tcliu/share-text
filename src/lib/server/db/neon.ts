import { Pool, type PoolClient } from '@neondatabase/serverless'
import type { Db, DbQuery, DbResult, DbStatement } from './types'
import { quoteIdentifier } from '../sql-rewrite.mjs'

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
      void client.query(`set search_path to ${quoteIdentifier(schemaName)}`).catch(error => {
        console.error('Failed to set search_path on Neon connection', { error })
      })
    })
  }

  return pool
}

// Run a statement on one client and shape it like `DbResult`.
async function runOnClient<T>(client: PoolClient, sql: string, params: unknown[]): Promise<DbResult<T>> {
  const result = await client.query(sql, params)
  return { rows: result.rows as T[], rowCount: result.rowCount }
}

export function createNeonDb(): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<DbResult<T>> {
      const result = await getPool().query(sql, params)
      return { rows: result.rows as T[], rowCount: result.rowCount }
    },
    async batch(statements: DbStatement[]): Promise<DbResult<unknown>[]> {
      if (statements.length === 0) {
        return []
      }
      const client = await getPool().connect()
      try {
        await client.query('begin')
        const results: DbResult<unknown>[] = []
        for (const statement of statements) {
          results.push(await runOnClient(client, statement.sql, statement.params ?? []))
        }
        await client.query('commit')
        return results
      } catch (error) {
        await client.query('rollback').catch(rollbackError => {
          console.error('Neon rollback failed', { rollbackError })
        })
        throw error
      } finally {
        client.release()
      }
    },
    async transaction<T>(fn: (query: DbQuery) => Promise<T>): Promise<T> {
      const client = await getPool().connect()
      try {
        await client.query('begin')
        const result = await fn(async <R>(sql: string, params: unknown[] = []) => runOnClient<R>(client, sql, params))
        await client.query('commit')
        return result
      } catch (error) {
        await client.query('rollback').catch(rollbackError => {
          console.error('Neon rollback failed', { rollbackError })
        })
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
