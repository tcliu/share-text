#!/usr/bin/env node

import { Pool } from '@neondatabase/serverless'
import { parseEnvFile } from './env-file.mjs'
import { quoteIdentifier, toSqliteSql } from '../src/lib/sql-rewrite.mjs'

export { parseEnvFile, quoteIdentifier, toSqliteSql }
// Schema-source path helpers live in the dependency-free db-schema-path.mjs so
// the deploy interview can import them without the Neon driver.
export { hasNeonSchema, neonSchemaPath } from './db-schema-path.mjs'

export function loadScriptEnv(env = process.env) {
  return {
    ...parseEnvFile('.env'),
    ...parseEnvFile('.env.local'),
    ...parseEnvFile('.env.vercel'),
    ...env,
  }
}

export function getDatabaseURL(env = process.env) {
  const loadedEnv = loadScriptEnv(env)
  return (loadedEnv.DATABASE_URL || '').trim()
}

export function resolveScriptProfile(env = process.env) {
  const explicit = (env.PROFILE || '').trim().toLowerCase()
  if (explicit === 'dev' || explicit === 'prod') return explicit

  const mergedProfile = (loadScriptEnv(env).PROFILE || '').trim().toLowerCase()
  if (mergedProfile === 'dev' || mergedProfile === 'prod') return mergedProfile

  return 'dev'
}

export function getSqlitePath(env = process.env) {
  const loadedEnv = loadScriptEnv(env)
  return (loadedEnv.SQLITE_PATH || '.data/dev.sqlite').trim()
}
export function getSchemaName(env = process.env) {
  const loadedEnv = loadScriptEnv(env)
  return (loadedEnv.SCHEMA_NAME || '').trim()
}
export function getVerifyTables(env = process.env) {
  const raw = (loadScriptEnv(env).SCHEMA_VERIFY_TABLES || 'app_meta').trim()
  const tables = raw
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
  return tables.length > 0 ? tables : ['app_meta']
}

// Host/database identifiers for log lines. Never returns credentials —
// only the hostname and path the operator needs to find the database.
export function describeDatabaseTarget(databaseURL) {
  try {
    const url = new URL(databaseURL)
    return {
      host: url.hostname || 'unknown',
      database: url.pathname.replace(/^\//, '') || 'unknown',
    }
  } catch {
    return { host: 'unknown', database: 'unknown' }
  }
}

export function createDbPool(env = process.env) {
  const databaseURL = getDatabaseURL(env)

  if (!databaseURL) {
    throw new Error('Missing DATABASE_URL for database access')
  }

  return new Pool({
    connectionString: databaseURL,
    max: 10,
  })
}
