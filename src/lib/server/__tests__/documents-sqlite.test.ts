// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  deleteDocument,
  DocumentLimitError,
  fetchDocument,
  fetchDocumentForAdmin,
  fetchDocumentSummaries,
  insertDocument,
  listDocumentsForAdmin,
  updateDocument,
} from '$lib/server/documents'
import { getMaxDocumentsPerUser, setSettingValue } from '$lib/server/settings'

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

  it('uses the generated key as the name when no name is provided', async () => {
    const created = await insertDocument({ content: '', by: '127.0.0.1' })

    expect(created.id).toMatch(/^[0-9a-z]{6}$/)
    expect(created.name).toBe(created.id)
  })

  it('respects a custom document_key_length setting', async () => {
    await setSettingValue('document_key_length', 8)
    try {
      const created = await insertDocument({ content: '', by: '10.0.0.77' })

      expect(created.id).toMatch(/^[0-9a-z]{8}$/)
      expect(created.name).toBe(created.id)
    } finally {
      await setSettingValue('document_key_length', 6)
    }
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
    const maxDocuments = await getMaxDocumentsPerUser()
    for (let i = 0; i < maxDocuments; i++) {
      await insertDocument({ name: `doc ${i}`, content: '', by: '10.0.0.99' })
    }

    await expect(
      insertDocument({ name: 'over limit', content: '', by: '10.0.0.99' }),
    ).rejects.toBeInstanceOf(DocumentLimitError)

    const other = await insertDocument({ name: 'other ip', content: '', by: '10.0.0.98' })
    expect(other.id).toMatch(/^[0-9a-z]{6}$/)
  })

  it('applies a runtime max_documents_per_ip setting', async () => {
    await setSettingValue('max_documents_per_ip', 1)
    try {
      await insertDocument({ name: 'only', content: '', by: '10.0.0.50' })
      await expect(
        insertDocument({ name: 'over limit', content: '', by: '10.0.0.50' }),
      ).rejects.toBeInstanceOf(DocumentLimitError)
    } finally {
      await setSettingValue('max_documents_per_ip', 10)
    }
  })

  it('lists documents for admin with search, creator filter, and metadata', async () => {
    const created = await insertDocument({ name: 'Alpha notes', content: 'hello', by: '10.0.0.7' })
    await insertDocument({ name: 'Beta doc', content: '', by: '10.0.0.8' })

    const all = await listDocumentsForAdmin()
    expect(all.total).toBe(2)
    expect(all.documents.map(document => document.name).sort()).toEqual(['Alpha notes', 'Beta doc'])
    expect(all.documents.find(document => document.name === 'Alpha notes')).toEqual(
      expect.objectContaining({
        id: created.id,
        name: 'Alpha notes',
        createdBy: '10.0.0.7',
        contentSize: 5,
      }),
    )

    const searched = await listDocumentsForAdmin({ search: 'alpha' })
    expect(searched.total).toBe(1)
    expect(searched.documents[0].name).toBe('Alpha notes')

    const byCreator = await listDocumentsForAdmin({ by: '10.0.0.8' })
    expect(byCreator.total).toBe(1)
    expect(byCreator.documents[0].name).toBe('Beta doc')

    const adminDoc = await fetchDocumentForAdmin(created.id)
    expect(adminDoc).toEqual(expect.objectContaining({ id: created.id, content: 'hello', createdBy: '10.0.0.7' }))
  })
})
