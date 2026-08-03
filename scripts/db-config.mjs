import { existsSync, readFileSync } from 'node:fs'
import { Pool } from 'pg'

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const values = {}
  const content = readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

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

export function getAppBaseURL(env = process.env) {
  const loadedEnv = loadScriptEnv(env)
  return (loadedEnv.APP_BASE_URL || '').trim()
}

export function resolveScriptProfile(env = process.env) {
  const explicit = (env.PROFILE || '').trim().toLowerCase()
  if (explicit === 'dev' || explicit === 'prod') return explicit

  const dotEnvProfile = (parseEnvFile('.env').PROFILE || '').trim().toLowerCase()
  if (dotEnvProfile === 'dev' || dotEnvProfile === 'prod') return dotEnvProfile

  return 'dev'
}

export function getSqlitePath(env = process.env) {
  const loadedEnv = loadScriptEnv(env)
  return (loadedEnv.SQLITE_PATH || '.data/share-text-dev.sqlite').trim()
}

export function toSqliteSql(sql) {
  return sql
    .replace(/\$\d+/g, () => '?')
    .replaceAll('bigserial', 'integer')
    .replaceAll('current_timestamp', "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
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
