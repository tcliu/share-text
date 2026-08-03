// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const cryptoMock = vi.hoisted(() => ({
  queue: [] as Buffer[],
  keyBuffer(bytes: number[]) {
    return Buffer.from([...bytes, ...Array<number>(37).fill(0)])
  },
}))

vi.mock('node:crypto', async importOriginal => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    randomBytes: (size: number) => cryptoMock.queue.shift() ?? actual.randomBytes(size),
  }
})

import { getDb } from '$lib/server/db'
import { insertDocument, MAX_KEY_ATTEMPTS } from '$lib/server/documents'

const A1B2C3 = [10, 1, 11, 2, 12, 3]
const D4E5F6 = [13, 4, 14, 5, 15, 6]

async function seedCollidingKey(key: string) {
  const db = await getDb()
  await db.query(
    `insert into documents (key, name, content, created_by, updated_by) values ($1, $2, $3, $4, $5)`,
    [key, 'existing', '', '10.0.0.200', '10.0.0.200'],
  )
}

describe('insertDocument key collision retry', () => {
  beforeEach(async () => {
    cryptoMock.queue.length = 0
    const db = await getDb()
    await db.query('delete from documents')
  })

  it('retries with a fresh key when the generated key collides', async () => {
    cryptoMock.queue.push(cryptoMock.keyBuffer(A1B2C3), cryptoMock.keyBuffer(D4E5F6))
    await seedCollidingKey('a1b2c3')

    const created = await insertDocument({ name: 'new', content: '', by: '127.0.0.1' })

    expect(created.id).toBe('d4e5f6')

    const db = await getDb()
    const result = await db.query<{ key: string }>('select key from documents where key in ($1, $2) order by key', [
      'a1b2c3',
      'd4e5f6',
    ])
    expect(result.rows.map(row => row.key)).toEqual(['a1b2c3', 'd4e5f6'])
  })

  it('rethrows after exhausting all attempts', async () => {
    cryptoMock.queue.push(...Array.from({ length: MAX_KEY_ATTEMPTS }, () => cryptoMock.keyBuffer(A1B2C3)))
    await seedCollidingKey('a1b2c3')

    await expect(insertDocument({ name: 'new', content: '', by: '127.0.0.1' })).rejects.toThrow(
      /UNIQUE constraint failed/,
    )
  })
})
