// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  deleteDocument,
  DocumentLimitError,
  fetchDocument,
  fetchDocumentSummaries,
  insertDocument,
  MAX_DOCUMENTS_PER_USER,
  updateDocument,
} from '$lib/server/documents'

beforeEach(async () => {
  const db = await getDb()
  await db.query('delete from documents')
})

describe('documents against the SQLite backend (dev profile)', () => {
  it('inserts and fetches a document', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '127.0.0.1' })

    expect(created.id).toMatch(/^[0-9a-z]{6}$/)
    expect(created.name).toBe('Notes')
    expect(created.content).toBe('body')
    expect(Number.isNaN(new Date(created.updatedAt).getTime())).toBe(false)

    const fetched = await fetchDocument(created.id)
    expect(fetched).toEqual(created)
  })

  it('returns null when fetching an unknown id', async () => {
    expect(await fetchDocument('zzzzzz')).toBeNull()
  })

  it('lists summaries ordered by most recently updated', async () => {
    const first = await insertDocument({ name: 'first', content: '', by: '127.0.0.1' })
    const second = await insertDocument({ name: 'second', content: '', by: '127.0.0.1' })
    await updateDocument(first.id, { content: 'touched', by: '192.168.1.2' })

    const summaries = await fetchDocumentSummaries()
    expect(summaries.map((summary: { id: string }) => summary.id)).toEqual([first.id, second.id])
    expect(summaries[0]).not.toHaveProperty('content')
  })

  it('scopes summaries to documents created by the given IP', async () => {
    const mine = await insertDocument({ name: 'mine', content: '', by: '10.0.0.7' })
    await insertDocument({ name: 'theirs', content: '', by: '10.0.0.8' })
    const editedByMe = await insertDocument({ name: 'shared', content: '', by: '10.0.0.8' })
    await updateDocument(editedByMe.id, { content: 'edited', by: '10.0.0.7' })

    const summaries = await fetchDocumentSummaries({ by: '10.0.0.7' })
    expect(summaries.map((summary: { id: string }) => summary.id)).toEqual([mine.id])
  })

  it('updates name and content', async () => {
    const created = await insertDocument({ name: 'old', content: 'old body', by: '127.0.0.1' })
    const updated = await updateDocument(created.id, { name: 'new', content: 'new body', by: '10.0.0.5' })

    expect(updated).toEqual(expect.objectContaining({ id: created.id, name: 'new', content: 'new body' }))
    expect(await fetchDocument(created.id)).toEqual(updated)
  })

  it('returns null when updating an unknown id', async () => {
    expect(await updateDocument('zzzzzz', { name: 'x', by: '127.0.0.1' })).toBeNull()
  })

  it('records the creating and last-updating IP along with created_at', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    const db = await getDb()
    const afterCreate = await db.query<{ created_by: string; updated_by: string; created_at: string }>(
      'select created_by, updated_by, created_at from documents where key = $1',
      [created.id],
    )
    expect(afterCreate.rows[0]).toMatchObject({ created_by: '10.0.0.1', updated_by: '10.0.0.1' })
    expect(Number.isNaN(new Date(afterCreate.rows[0].created_at).getTime())).toBe(false)

    await updateDocument(created.id, { content: 'edited', by: '203.0.113.7' })
    const afterUpdate = await db.query<{ updated_by: string; created_by: string }>(
      'select created_by, updated_by from documents where key = $1',
      [created.id],
    )
    expect(afterUpdate.rows[0]).toMatchObject({ created_by: '10.0.0.1', updated_by: '203.0.113.7' })
  })

  it('deletes a document', async () => {
    const created = await insertDocument({ name: 'gone', content: '', by: '127.0.0.1' })
    expect(await deleteDocument(created.id)).toBe(true)
    expect(await deleteDocument(created.id)).toBe(false)
    expect(await fetchDocument(created.id)).toBeNull()
  })

  it('caps how many documents one IP can create', async () => {
    for (let i = 0; i < MAX_DOCUMENTS_PER_USER; i++) {
      await insertDocument({ name: `doc ${i}`, content: '', by: '10.0.0.99' })
    }

    await expect(
      insertDocument({ name: 'over limit', content: '', by: '10.0.0.99' }),
    ).rejects.toBeInstanceOf(DocumentLimitError)

    const other = await insertDocument({ name: 'other ip', content: '', by: '10.0.0.98' })
    expect(other.id).toMatch(/^[0-9a-z]{6}$/)
  })
})
