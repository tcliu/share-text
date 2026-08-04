import type { Db } from './db-types'
import { createPgDb } from './db-pg'
import { createSqliteDb } from './db-sqlite'
import { resolveProfile } from './profile'

let db: Db | null = null
let dbPromise: Promise<Db> | null = null

export async function getDb(): Promise<Db> {
  if (db) {
    return db
  }
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = (async () => {
    const initialized = resolveProfile() === 'prod' ? createPgDb() : await createSqliteDb()
    db = initialized
    return initialized
  })()

  try {
    return await dbPromise
  } finally {
    dbPromise = null
  }
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}
