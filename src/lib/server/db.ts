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
    const profile = resolveProfile()
    const initialized = profile === 'prod' ? createPgDb() : await createSqliteDb()
    if (profile === 'prod') {
      await initialized.query("alter table documents add column if not exists tags text not null default '[]'")
      await initialized.query(
        `create table if not exists document_versions (
          id bigserial primary key,
          document_id text not null references documents(key) on update cascade on delete cascade,
          content text not null,
          document_type text not null default 'text',
          created_by text not null,
          created_at timestamptz not null default current_timestamp
        )`,
      )
    }
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
