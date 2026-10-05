import type { Db } from './db-types'
import { createNeonDb } from './db-neon'
import { createSqliteDb } from './db-sqlite'
import { resolveProfile } from './profile'
import { errorMessage, logEvent } from './logging'

// Additive-only DDL for an already-launched Postgres database. Every table in
// `sql/schema.sql` is created here too (the base `documents` table included, so
// a fresh prod database is complete), plus the indexes and the Postgres-only
// pg_trgm trigram index used by `sql-search.ts` for leading-wildcard search.
// Existing rows survive: `create ... if not exists` / `add column if not exists`
// never drop or rebuild. A test asserts this set covers every `create table` /
// `create index` in `sql/schema.sql`.
// A migration statement that only improves search performance: an app role
// without `create extension` privileges may reject it, and boot must not fail
// over an optional index.
const OPTIONAL_MIGRATION = /pg_trgm|gin_trgm_ops/i

export const PROD_MIGRATIONS: readonly string[] = [
  `create table if not exists users (
    id bigserial primary key,
    username text unique not null,
    email text unique not null,
    password_hash text not null,
    status text not null default 'active',
    created_at timestamptz not null default current_timestamp
  )`,
  `create table if not exists documents (
    id bigserial primary key,
    key text unique not null,
    name text not null,
    content text not null default '',
    document_type text not null default 'text',
    tags text not null default '[]',
    created_by text not null,
    updated_by text not null,
    owner_user_id bigint references users(id) on delete set null,
    is_public boolean not null default true,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
  )`,
  "alter table documents add column if not exists tags text not null default '[]'",
  `create table if not exists document_versions (
    id bigserial primary key,
    document_id bigint not null references documents(id) on delete cascade,
    content text not null,
    document_type text not null default 'text',
    created_by text not null,
    created_at timestamptz not null default current_timestamp
  )`,
  `create table if not exists document_shares (
    document_id bigint not null references documents(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    created_at timestamptz not null default current_timestamp,
    primary key (document_id, user_id)
  )`,
  `create table if not exists user_config (
    user_id bigint not null references users(id) on delete cascade,
    key text not null,
    value text not null,
    updated_at timestamptz not null default current_timestamp,
    primary key (user_id, key)
  )`,
  `create table if not exists user_preferences (
    user_id bigint not null references users(id) on delete cascade,
    preferred_language text not null default 'en',
    updated_at timestamptz not null default current_timestamp,
    primary key (user_id)
  )`,
  `create table if not exists admin_preferences (
    username text primary key,
    preferred_language text not null default 'en',
    updated_at timestamptz not null default current_timestamp
  )`,
  `create table if not exists login_attempts (
    ip text primary key,
    attempt_count integer not null default 0,
    reset_at timestamptz not null
  )`,
  `create table if not exists app_config (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default current_timestamp
  )`,
  'alter table documents add column if not exists owner_user_id bigint references users(id) on delete set null',
  'alter table documents add column if not exists is_public boolean not null default true',
  "alter table users add column if not exists status text not null default 'active'",
  'create index if not exists idx_documents_updated_at on documents (updated_at desc)',
  'create index if not exists idx_document_versions_document_id_created_at on document_versions (document_id, created_at desc)',
  'create extension if not exists pg_trgm',
  'create index if not exists idx_documents_name_trgm on documents using gin (lower(name) gin_trgm_ops)',
]

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
    const initialized = profile === 'prod' ? createNeonDb() : await createSqliteDb()
    if (profile === 'prod') {
      for (const statement of PROD_MIGRATIONS) {
        try {
          await initialized.query(statement)
        } catch (error) {
          if (OPTIONAL_MIGRATION.test(statement)) {
            logEvent({
              action: 'db_migration_skipped',
              details: { statement, error: errorMessage(error) },
            })
            continue
          }
          throw error
        }
      }
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
