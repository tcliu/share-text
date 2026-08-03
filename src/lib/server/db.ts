import type { Db } from './db-types'
import { createPgDb } from './db-pg'
import { createSqliteDb } from './db-sqlite'
import { resolveProfile } from './profile'

let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) return db

  db = resolveProfile() === 'prod' ? createPgDb() : await createSqliteDb()
  return db
}
