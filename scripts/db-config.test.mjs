import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { hasNeonSchema, neonSchemaPath, toSqliteSql } from './db-config.mjs'

describe('neonSchemaPath', () => {
  it('points at sql/schema.sql under the root', () => {
    expect(neonSchemaPath('/repo')).toBe(join('/repo', 'sql', 'schema.sql'))
  })
})

describe('hasNeonSchema', () => {
  it('detects a present schema file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-present-'))
    mkdirSync(join(dir, 'sql'), { recursive: true })
    writeFileSync(join(dir, 'sql', 'schema.sql'), 'create table t (id integer);\n')
    expect(hasNeonSchema(dir)).toBe(true)
  })

  it('reports a missing schema file', () => {
    expect(hasNeonSchema(mkdtempSync(join(tmpdir(), 'schema-missing-')))).toBe(false)
  })
})

describe('toSqliteSql', () => {
  // Regression guard: the Postgres-token rewrite must not touch string
  // literals, quoted identifiers or comments that merely contain those words.
  it('rewrites postgres tokens but leaves literals, identifiers and comments intact', () => {
    const sql = [
      '-- bigserial in a line comment survives',
      "create table t (id bigserial primary key, note text default 'bigserial here');",
      '/* current_timestamp in a block comment survives */',
      'alter table t alter column a set default current_timestamp;',
      'comment on column t."bigserial" is \'quoted identifier\';',
    ].join('\n')
    const out = toSqliteSql(sql)
    expect(out).toContain('-- bigserial in a line comment survives')
    expect(out).toContain("'bigserial here'")
    expect(out).toContain('/* current_timestamp in a block comment survives */')
    expect(out).toContain('"bigserial"')
    expect(out).toContain('id integer primary key')
    expect(out).toContain("strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  })
})
