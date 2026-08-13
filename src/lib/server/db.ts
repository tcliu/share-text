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
        `create table if not exists users (
          id bigserial primary key,
          username text unique not null,
          email text unique not null,
          password_hash text not null,
          created_at timestamptz not null default current_timestamp
        )`,
      )
      await initialized.query(
        `create table if not exists document_versions (
          id bigserial primary key,
          document_id bigint not null references documents(id) on delete cascade,
          content text not null,
          document_type text not null default 'text',
          created_by text not null,
          created_at timestamptz not null default current_timestamp
        )`,
      )
      await initialized.query(
        `create table if not exists document_shares (
          document_id bigint not null references documents(id) on delete cascade,
          user_id bigint not null references users(id) on delete cascade,
          created_at timestamptz not null default current_timestamp,
          primary key (document_id, user_id)
        )`,
      )
      await initialized.query(
        `create table if not exists user_config (
          user_id bigint not null references users(id) on delete cascade,
          key text not null,
          value text not null,
          updated_at timestamptz not null default current_timestamp,
          primary key (user_id, key)
        )`,
      )
      await initialized.query(
        'alter table documents add column if not exists owner_user_id bigint references users(id) on delete set null',
      )
      await initialized.query('alter table documents add column if not exists is_public boolean not null default true')
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
