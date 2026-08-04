import { readFile } from 'node:fs/promises'
import { createDbPool, getSchemaName, resolveScriptProfile } from './db-config.mjs'

const profile = resolveScriptProfile()

if (profile !== 'prod') {
  console.error('recreate-schema.mjs only supports PROFILE=prod. For dev, delete the SQLite file and restart the server.')
  process.exit(1)
}

const schemaName = getSchemaName()
if (!schemaName) {
  console.error('Missing SCHEMA_NAME in .env.vercel or environment.')
  process.exit(1)
}

const pool = createDbPool()

try {
  console.log(`Dropping schema "${schemaName}"...`)
  await pool.query(`drop schema if exists "${schemaName}" cascade`)

  const sql = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8')
  console.log(`Applying schema to "${schemaName}"...`)
  await pool.query(`create schema if not exists "${schemaName}"`)
  await pool.query(`set search_path to "${schemaName}"`)
  await pool.query(sql)

  console.log(`Done. Schema "${schemaName}" recreated successfully.`)
} finally {
  await pool.end()
}
