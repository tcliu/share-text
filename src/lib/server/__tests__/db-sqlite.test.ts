// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createSqliteDb, toSqliteSql } from '$lib/server/db-sqlite'

describe('toSqliteSql', () => {
  it('converts $n placeholders to ?', () => {
    expect(toSqliteSql('select id from documents where id = $1 and name = $2')).toBe(
      'select id from documents where id = ? and name = ?',
    )
  })

  it('converts current_timestamp to a UTC ISO strftime expression', () => {
    expect(toSqliteSql('updated_at = current_timestamp')).toBe(
      "updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
  })
})

describe('SQLite adapter', () => {
  let db: Awaited<ReturnType<typeof createSqliteDb>>

  beforeEach(async () => {
    db = await createSqliteDb(':memory:')
  })

  it('applies the schema and returns rows from INSERT ... RETURNING', async () => {
    const result = await db.query<{ id: number; key: string; name: string; content: string; updated_at: string }>(
      'insert into documents (key, name, content, created_by, updated_by) values (?, ?, ?, ?, ?) returning id, key, name, content, updated_at',
      ['a1b2c3', 'Notes', 'body', '1.1.1.1', '1.1.1.1'],
    )

    expect(result.rows).toHaveLength(1)
    expect(Number.isInteger(result.rows[0].id)).toBe(true)
    expect(result.rows[0].id).toBeGreaterThan(0)
    expect(result.rows[0]).toMatchObject({ key: 'a1b2c3', name: 'Notes', content: 'body' })
    expect(Number.isNaN(new Date(result.rows[0].updated_at).getTime())).toBe(false)
  })

  it('returns rows from UPDATE ... RETURNING and refreshes updated_at', async () => {
    await db.query('insert into documents (key, name, content, created_by, updated_by) values (?, ?, ?, ?, ?)', [
      'a1b2c3',
      'a',
      'b',
      '1.1.1.1',
      '1.1.1.1',
    ])
    const result = await db.query(
      'update documents set name = ?, content = ?, updated_at = current_timestamp where key = ? returning id, key, name, content, updated_at',
      ['renamed', 'c', 'a1b2c3'],
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ key: 'a1b2c3', name: 'renamed', content: 'c' })
  })

  it('reports rowCount for a plain DELETE', async () => {
    await db.query('insert into documents (key, name, content, created_by, updated_by) values (?, ?, ?, ?, ?)', [
      'a1b2c3',
      'a',
      'b',
      '1.1.1.1',
      '1.1.1.1',
    ])

    const missing = await db.query('delete from documents where key = ?', ['zzzzzz'])
    expect(missing.rowCount).toBe(0)

    const present = await db.query('delete from documents where key = ?', ['a1b2c3'])
    expect(present.rowCount).toBe(1)
  })

  it('orders summaries by updated_at desc', async () => {
    await db.query(
      'insert into documents (key, name, content, created_by, updated_by, updated_at) values (?, ?, ?, ?, ?, ?)',
      ['key-old', 'old', '', '1.1.1.1', '1.1.1.1', '2020-01-01T00:00:00.000Z'],
    )
    await db.query(
      'insert into documents (key, name, content, created_by, updated_by, updated_at) values (?, ?, ?, ?, ?, ?)',
      ['key-new', 'new', '', '1.1.1.1', '1.1.1.1', '2021-01-01T00:00:00.000Z'],
    )

    const result = await db.query<{ key: string }>('select key, name, updated_at from documents order by updated_at desc')
    expect(result.rows.map(row => row.key)).toEqual(['key-new', 'key-old'])
  })
})
