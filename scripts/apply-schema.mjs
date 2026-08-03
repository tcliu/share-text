import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  createDbPool,
  getSqlitePath,
  resolveScriptProfile,
  toSqliteSql,
} from './db-config.mjs'

const profile = resolveScriptProfile()
const sql = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8')

if (profile === 'dev') {
  const { DatabaseSync } = await import('node:sqlite')
  const path = getSqlitePath()

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const database = new DatabaseSync(path)
  database.exec(toSqliteSql(sql))
  database.close()

  console.log(`Applied sql/schema.sql to the dev SQLite database (${path})`)
} else {
  const pool = createDbPool()

  try {
    await pool.query(sql)
    console.log('Applied sql/schema.sql to the database')
  } finally {
    await pool.end()
  }
}
