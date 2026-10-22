// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  isRowsReturningSql,
  quoteIdentifier,
  toSqliteParam,
  toSqliteQuery,
  toSqliteSql,
} from './sql-rewrite.mjs'

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"

describe('toSqliteSql', () => {
  it('maps Postgres-only tokens to SQLite', () => {
    expect(toSqliteSql('id bigserial, at current_timestamp')).toBe(`id integer, at ${NOW}`)
  })

  it('maps a zero-arg now() call, including spacing and case', () => {
    expect(toSqliteSql('default now()')).toBe(`default ${NOW}`)
    expect(toSqliteSql('default NOW ()')).toBe(`default ${NOW}`)
  })

  it('rewrites $n placeholders and leaves strings and comments untouched', () => {
    expect(toSqliteSql('select $1, $2')).toBe('select ?, ?')
    expect(toSqliteSql("x text default 'now()'")).toBe("x text default 'now()'")
    expect(toSqliteSql('-- now()\ny int')).toBe('-- now()\ny int')
    expect(toSqliteSql('e int default random()')).toBe('e int default random()')
  })
})

describe('toSqliteQuery', () => {
  it('emits one coerced value per $n occurrence', () => {
    expect(
      toSqliteQuery('insert into t (a, b, c) values ($1, $2, $1)', [
        true,
        new Date('2020-01-02T03:04:05.000Z'),
      ]),
    ).toEqual({
      text: 'insert into t (a, b, c) values (?, ?, ?)',
      values: [1, '2020-01-02T03:04:05.000Z', 1],
    })
  })

  it('coerces undefined to null', () => {
    expect(toSqliteQuery('select $1', [undefined])).toEqual({ text: 'select ?', values: [null] })
  })
})

describe('toSqliteParam', () => {
  it('coerces booleans, Dates, and undefined', () => {
    expect(toSqliteParam(true)).toBe(1)
    expect(toSqliteParam(false)).toBe(0)
    expect(toSqliteParam(new Date('2020-01-02T03:04:05.000Z'))).toBe('2020-01-02T03:04:05.000Z')
    expect(toSqliteParam(undefined)).toBeNull()
    expect(toSqliteParam('x')).toBe('x')
  })
})

describe('isRowsReturningSql', () => {
  it('detects selects, CTEs, and returning clauses', () => {
    expect(isRowsReturningSql('  select 1')).toBe(true)
    expect(isRowsReturningSql('with c as (select 1) select * from c')).toBe(true)
    expect(isRowsReturningSql('insert into t default values returning id')).toBe(true)
    expect(isRowsReturningSql('insert into t default values')).toBe(false)
  })
})

describe('quoteIdentifier', () => {
  it('quotes and escapes double quotes', () => {
    expect(quoteIdentifier('public')).toBe('"public"')
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"')
  })

  it('rejects empty, non-string, and NUL-containing input', () => {
    expect(() => quoteIdentifier('')).toThrow(/Invalid identifier/)
    expect(() => quoteIdentifier(null)).toThrow(/Invalid identifier/)
    expect(() => quoteIdentifier('a\u0000b')).toThrow(/Invalid identifier/)
  })
})
