import type { Db, DbKind } from './types'
import { createNeonDb } from './neon'
import { createSqliteDb } from './sqlite'
import { createD1Db, isD1Database, type D1DatabaseLike } from './d1'
import { resolveProfile } from '../profile'
import { errorMessage, logEvent } from '../logging'
import { toDbError } from './errors'
import { D1_BINDING_NAME } from '../../d1-binding.mjs'

// Database selector. One file per provider (`sqlite.ts`, `neon.ts`, `d1.ts`);
// this module owns backend resolution, caching, prod migrations, and the
// public surface the server uses. Add a provider by implementing the `Db`
// interface in its own file and adding one branch to `resolveDbConfig`.
export type { Db, DbKind, DbQuery, DbResult, DbStatement } from './types'

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

interface DbConfig {
  kind: DbKind
  create: () => Promise<Db>
}

function databaseUrl(env: NodeJS.ProcessEnv): string {
  return String(env.DATABASE_URL || '').trim()
}

// Cloudflare Workers expose bindings (the D1 database included) on the request
// `env`, not on `process.env`; `nodejs_compat` only mirrors vars/secrets/version
// metadata. The deploy flow forces `CF_PAGES=1`, so it marks the Workers runtime
// without a probe that would run on Node.
function isCloudflareRuntime(env: NodeJS.ProcessEnv): boolean {
  return String(env.CF_PAGES ?? '').trim() === '1'
}

// The specifier is built through a function so a non-Cloudflare bundle does not
// try to resolve `cloudflare:workers` at build time; only the Workers runtime
// resolves it.
function cloudflareWorkersSpecifier() {
  return 'cloudflare:workers'
}

interface CloudflareWorkersModule {
  env?: Record<string, unknown>
}

let cloudflareWorkersModule: Promise<CloudflareWorkersModule | null> | null = null

function importCloudflareWorkers(): Promise<CloudflareWorkersModule | null> {
  if (!cloudflareWorkersModule) {
    // Only reachable on a Workers runtime (the caller gates on `CF_PAGES`), so a
    // failure means the binding could not be read — surface it once.
    cloudflareWorkersModule = import(/* @vite-ignore */ cloudflareWorkersSpecifier()).catch(error => {
      logEvent({
        action: 'cloudflare_env_import_error',
        details: { error: errorMessage(error), level: 'WARN' },
      })
      return null
    })
  }
  return cloudflareWorkersModule
}

async function resolveD1Binding(env: NodeJS.ProcessEnv): Promise<D1DatabaseLike | null> {
  const direct = (env as unknown as Record<string, unknown>)[D1_BINDING_NAME]
  if (isD1Database(direct)) {
    return direct
  }
  if (!isCloudflareRuntime(env)) {
    return null
  }
  const workerEnv = (await importCloudflareWorkers())?.env?.[D1_BINDING_NAME]
  return isD1Database(workerEnv) ? workerEnv : null
}

// Backend precedence: a prod profile with no DATABASE_URL and a reachable D1
// binding is D1; prod otherwise is Neon; anything else is dev SQLite.
export async function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): Promise<DbConfig> {
  const profile = resolveProfile(env)
  if (profile === 'prod' && !databaseUrl(env)) {
    const binding = await resolveD1Binding(env)
    if (binding) {
      return { kind: 'd1', create: async () => createD1Db(binding) }
    }
  }
  if (profile === 'prod') {
    return { kind: 'neon', create: async () => createNeonDb() }
  }
  return { kind: 'sqlite', create: createSqliteDb }
}

let db: Db | null = null
let dbPromise: Promise<Db> | null = null

export async function getDb(env: NodeJS.ProcessEnv = process.env): Promise<Db> {
  if (db) {
    return db
  }
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = (async () => {
    const config = await resolveDbConfig(env)
    // D1 is stateless (no pool) and its binding can differ per request; skip
    // the cache for it.
    if (config.kind === 'd1') {
      return config.create()
    }
    const initialized = await config.create().catch(error => {
      throw toDbError(error)
    })
    // Production Postgres never runs DDL through `sql/schema.sql`; it applies
    // the additive PROD_MIGRATIONS instead, which a fresh Neon database needs.
    // (D1 returns above: `apply-d1-schema.mjs` owns its schema, and these
    // Postgres-flavoured statements would not parse.) Dev SQLite auto-applies
    // the schema on open.
    if (config.kind === 'neon') {
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
