// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PROD_MIGRATIONS } from '#lib/server/db/index.js'

const schema = readFileSync(new URL('../../../../sql/schema.sql', import.meta.url), 'utf8')
const migrations = PROD_MIGRATIONS.join('\n')

function declaredNames(source: string, kind: 'table' | 'index') {
  const pattern = new RegExp(`create ${kind} if not exists ([a-z_][a-z0-9_]*)`, 'gi')
  return [...source.matchAll(pattern)].map(match => match[1])
}

// The prod additive migrations in `db.ts` must keep an existing Postgres
// database in sync with the dev schema source. A table or index present in
// `sql/schema.sql` but missing from `PROD_MIGRATIONS` breaks the feature it
// backs on a database deployed before that feature (see the app_config gap).
describe('PROD_MIGRATIONS coverage of sql/schema.sql', () => {
  it('creates every table declared in schema.sql', () => {
    const tables = declaredNames(schema, 'table')
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) {
      expect(migrations).toMatch(new RegExp(`create table if not exists ${table}\\b`, 'i'))
    }
  })

  it('creates every index declared in schema.sql', () => {
    const indexes = declaredNames(schema, 'index')
    expect(indexes.length).toBeGreaterThan(0)
    for (const index of indexes) {
      expect(migrations).toMatch(new RegExp(`create index if not exists ${index}\\b`, 'i'))
    }
  })

  it('marks the pg_trgm extension and trigram index as optional migrations', () => {
    // `create extension pg_trgm` and its GIN index require privileges the app
    // role may lack on a managed database; boot must skip them rather than
    // fail, so they must be the only statements the optional-migration guard
    // recognizes.
    const optional = PROD_MIGRATIONS.filter(statement => /pg_trgm|gin_trgm_ops/i.test(statement))
    expect(optional).toHaveLength(2)
  })
})
