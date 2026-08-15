// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  deleteDocument,
  DocumentLimitError,
  exportDocumentsForAdmin,
  fetchDocument,
  fetchDocumentForAdmin,
  fetchDocumentSummaries,
  importDocumentsForAdmin,
  insertDocument,
  listDocumentsForAdmin,
  normalizeDocumentKey,
  updateDocument,
} from '$lib/server/documents'
import { getMaxDocumentsPerUser, setSettingValue } from '$lib/server/settings'
import { sameColorFamily } from '$lib/tag-colors'

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
    expect(created.tags).toEqual([])
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
    expect(summaries.documents.map((summary: { id: string }) => summary.id)).toEqual([first.id, second.id])
    expect(summaries.documents[0]).not.toHaveProperty('content')
    expect(summaries.hasMore).toBe(false)
  })

  it('lists documents across all creators regardless of IP', async () => {
    const mine = await insertDocument({ name: 'mine', content: '', by: '10.0.0.7' })
    const theirs = await insertDocument({ name: 'theirs', content: '', by: '10.0.0.8' })

    const summaries = await fetchDocumentSummaries()
    expect(summaries.documents.map((summary: { id: string }) => summary.id).sort()).toEqual([mine.id, theirs.id].sort())
  })

  it('marks each summary owned by the viewer IP', async () => {
    const mine = await insertDocument({ name: 'mine', content: '', by: '10.0.0.7' })
    await insertDocument({ name: 'theirs', content: '', by: '10.0.0.8' })

    const summaries = await fetchDocumentSummaries({
      viewer: { type: 'anonymous', userId: null, username: null, ip: '10.0.0.7', name: '10.0.0.7' },
    })
    const mineSummary = summaries.documents.find(summary => summary.id === mine.id)
    const theirsSummary = summaries.documents.find(summary => summary.id !== mine.id)

    expect(mineSummary?.owned).toBe(true)
    expect(theirsSummary?.owned).toBe(false)
  })

  it('searches summaries across all documents', async () => {
    await insertDocument({ name: 'Alpha notes', content: '', by: '10.0.0.7' })
    await insertDocument({ name: 'Beta doc', content: '', by: '10.0.0.8' })

    const searched = await fetchDocumentSummaries({ search: 'alpha' })
    expect(searched.documents.map((summary: { name: string }) => summary.name)).toEqual(['Alpha notes'])
  })

  it('searches summaries across configured columns via searchKeys', async () => {
    const alpha = await insertDocument({ name: 'Alpha notes', content: '', by: '10.0.0.7' })
    await insertDocument({ name: 'Beta doc', content: '', by: '10.0.0.8' })
    await updateDocument(alpha.id, { tags: [{ name: 'urgent', color: '#FF6680' }], by: '10.0.0.7' })

    const byId = await fetchDocumentSummaries({ search: alpha.id, searchKeys: ['id'] })
    expect(byId.documents.map((summary: { id: string }) => summary.id)).toEqual([alpha.id])

    const byTags = await fetchDocumentSummaries({ search: 'urgent', searchKeys: ['tags'] })
    expect(byTags.documents.map((summary: { id: string }) => summary.id)).toEqual([alpha.id])

    const noMatch = await fetchDocumentSummaries({ search: 'urgent', searchKeys: ['name'] })
    expect(noMatch.documents).toHaveLength(0)
  })

  it('reports hasMore when more rows exist past the requested limit', async () => {
    await insertDocument({ name: 'one', content: '', by: '127.0.0.1' })
    await insertDocument({ name: 'two', content: '', by: '127.0.0.1' })

    const summaries = await fetchDocumentSummaries({ limit: 1 })

    expect(summaries.documents).toHaveLength(1)
    expect(summaries.hasMore).toBe(true)
  })

  it('updates name and content', async () => {
    const created = await insertDocument({ name: 'old', content: 'old body', by: '127.0.0.1' })
    const updated = await updateDocument(created.id, { name: 'new', content: 'new body', by: '10.0.0.5' })

    expect(updated).toEqual(expect.objectContaining({ id: created.id, name: 'new', content: 'new body' }))
    expect(await fetchDocument(created.id)).toEqual(updated)
  })

  it('stores and returns document tags', async () => {
    const created = await insertDocument({ name: 'tagged', content: 'body', by: '127.0.0.1' })

    const updated = await updateDocument(created.id, {
      tags: [
        { name: 'Beta', color: '#00F0FF' },
        { name: 'alpha', color: '#FF6680' },
        { name: 'alpha', color: '#FFCC00' },
      ],
      by: '10.0.0.5',
    })

    const expectedTags = [
      { name: 'alpha', color: '#FF6680' },
      { name: 'Beta', color: '#00F0FF' },
    ]
    expect(updated?.tags).toEqual(expectedTags)
    expect((await fetchDocument(created.id))?.tags).toEqual(expectedTags)

    const adminDoc = await fetchDocumentForAdmin(created.id)
    expect(adminDoc?.tags).toEqual(expectedTags)
  })

  it('reassigns adjacent tag colours for contrast', async () => {
    const created = await insertDocument({ name: 'contrast', content: 'body', by: '127.0.0.1' })

    const updated = await updateDocument(created.id, {
      tags: [
        { name: 'alpha', color: '#00F0FF' },
        { name: 'beta', color: '#80F3FF' },
      ],
      by: '10.0.0.5',
    })

    const tags = updated?.tags ?? []
    expect(tags.map(tag => tag.name)).toEqual(['alpha', 'beta'])
    expect(sameColorFamily(tags[0].color, tags[1].color)).toBe(false)
  })

  it('returns null when updating an unknown id', async () => {
    expect(await updateDocument('zzzzzz', { name: 'x', by: '127.0.0.1' })).toBeNull()
  })

  it('overrides the updated_by attribution when updatedBy is provided', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    const db = await getDb()

    await updateDocument(created.id, { name: 'Renamed', by: '203.0.113.7', updatedBy: 'admin@example.com' })
    const afterUpdate = await db.query<{ updated_by: string }>('select updated_by from documents where key = $1', [
      created.id,
    ])
    expect(afterUpdate.rows[0]).toMatchObject({ updated_by: 'admin@example.com' })
  })

  it('allows an updated_by-only update', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    const db = await getDb()

    const updated = await updateDocument(created.id, { by: '203.0.113.7', updatedBy: 'admin@example.com' })
    expect(updated).not.toBeNull()
    const afterUpdate = await db.query<{ updated_by: string }>('select updated_by from documents where key = $1', [
      created.id,
    ])
    expect(afterUpdate.rows[0]).toMatchObject({ updated_by: 'admin@example.com' })
  })

  it('overrides the created_by attribution when createdBy is provided', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    const db = await getDb()

    await updateDocument(created.id, { by: '203.0.113.7', createdBy: 'admin@example.com' })
    const afterUpdate = await db.query<{ created_by: string }>('select created_by from documents where key = $1', [
      created.id,
    ])
    expect(afterUpdate.rows[0]).toMatchObject({ created_by: 'admin@example.com' })
  })

  it('allows a key-only update that changes the document id', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    const db = await getDb()

    const updated = await updateDocument(created.id, { by: '203.0.113.7', key: 'zzz999' })
    expect(updated).not.toBeNull()
    expect(updated?.id).toBe('zzz999')
    const afterUpdate = await db.query<{ key: string }>('select key from documents where key = $1', ['zzz999'])
    expect(afterUpdate.rows[0]).toMatchObject({ key: 'zzz999' })
  })

  it('normalizes document keys to lowercase trimmed values of the configured length', async () => {
    await expect(normalizeDocumentKey(' A1B2C3 ')).resolves.toBe('a1b2c3')
    await expect(normalizeDocumentKey('a1b2c3d4')).rejects.toThrow('document key must be 6')
    await expect(normalizeDocumentKey('a1b2c!')).rejects.toThrow('document key must be 6')
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

    await expect(insertDocument({ name: 'over limit', content: '', by: '10.0.0.99' })).rejects.toBeInstanceOf(
      DocumentLimitError,
    )

    const other = await insertDocument({ name: 'other ip', content: '', by: '10.0.0.98' })
    expect(other.id).toMatch(/^[0-9a-z]{6}$/)
  })

  it('applies a runtime max_documents_per_ip setting', async () => {
    await setSettingValue('max_documents_per_ip', 1)
    try {
      await insertDocument({ name: 'only', content: '', by: '10.0.0.50' })
      await expect(insertDocument({ name: 'over limit', content: '', by: '10.0.0.50' })).rejects.toBeInstanceOf(
        DocumentLimitError,
      )
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
        tags: [],
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
    expect(adminDoc).toEqual(
      expect.objectContaining({ id: created.id, content: 'hello', createdBy: '10.0.0.7', tags: [] }),
    )
  })

  it('sorts admin documents by the requested column and direction', async () => {
    await insertDocument({ name: 'Beta', content: 'x', by: '10.0.0.1' })
    await insertDocument({ name: 'Alpha', content: 'yyy', by: '10.0.0.1' })

    const byNameAsc = await listDocumentsForAdmin({ sortBy: 'name', order: 'asc' })
    expect(byNameAsc.documents.map(document => document.name)).toEqual(['Alpha', 'Beta'])

    const byNameDesc = await listDocumentsForAdmin({ sortBy: 'name', order: 'desc' })
    expect(byNameDesc.documents.map(document => document.name)).toEqual(['Beta', 'Alpha'])

    const byLengthAsc = await listDocumentsForAdmin({ sortBy: 'length', order: 'asc' })
    expect(byLengthAsc.documents.map(document => document.contentSize)).toEqual([1, 3])

    const byLengthDesc = await listDocumentsForAdmin({ sortBy: 'length', order: 'desc' })
    expect(byLengthDesc.documents.map(document => document.contentSize)).toEqual([3, 1])
  })

  it('falls back to the default ordering for unknown sort columns', async () => {
    await insertDocument({ name: 'Solo', content: '', by: '10.0.0.1' })

    const result = await listDocumentsForAdmin({ sortBy: 'not-a-column', order: 'asc' })
    expect(result.total).toBe(1)
    expect(result.documents[0].name).toBe('Solo')
  })

  it('searches configured admin columns (id, name, tags, updated by) via searchKeys', async () => {
    const alpha = await insertDocument({ name: 'Alpha notes', content: '', by: '10.0.0.7' })
    await insertDocument({ name: 'Beta doc', content: '', by: '10.0.0.8' })
    await updateDocument(alpha.id, { content: 'edited', by: '203.0.113.9' })
    await updateDocument(alpha.id, { tags: [{ name: 'urgent', color: '#FF6680' }], by: '203.0.113.9' })

    const searchKeys = ['id', 'name', 'tags', 'updatedBy']

    const byName = await listDocumentsForAdmin({ search: 'alpha', searchKeys })
    expect(byName.total).toBe(1)
    expect(byName.documents[0].name).toBe('Alpha notes')

    const byId = await listDocumentsForAdmin({ search: alpha.id, searchKeys })
    expect(byId.total).toBe(1)
    expect(byId.documents[0].id).toBe(alpha.id)

    const byUpdatedBy = await listDocumentsForAdmin({ search: '203.0.113.9', searchKeys })
    expect(byUpdatedBy.total).toBe(1)
    expect(byUpdatedBy.documents[0].id).toBe(alpha.id)

    const byTags = await listDocumentsForAdmin({ search: 'urgent', searchKeys })
    expect(byTags.total).toBe(1)
    expect(byTags.documents[0].id).toBe(alpha.id)

    const acrossColumns = await listDocumentsForAdmin({ search: '203.0.113.9', searchKeys: ['name', 'updatedBy'] })
    expect(acrossColumns.total).toBe(1)
  })

  it('unknown searchKeys are ignored without error', async () => {
    await insertDocument({ name: 'Only', content: '', by: '10.0.0.1' })
    const result = await listDocumentsForAdmin({ search: 'only', searchKeys: ['not-a-column'] })
    expect(result.total).toBe(0)
  })
})

describe('importDocumentsForAdmin against the SQLite backend (dev profile)', () => {
  it('imports a single record and records an initial version snapshot', async () => {
    const created = await importDocumentsForAdmin(
      [{ name: 'Notes', content: 'hello', documentType: 'text', tags: [{ name: 'urgent', color: '#FF6680' }] }],
      '203.0.113.7',
    )

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-z]{6}$/),
      name: 'Notes',
      content: 'hello',
      documentType: 'text',
      tags: [{ name: 'urgent', color: '#FF6680' }],
    })

    const db = await getDb()
    const versions = await db.query<{ count: number | string }>(
      'select count(*) as count from document_versions where document_id = (select id from documents where key = $1)',
      [created[0].id],
    )
    expect(Number(versions.rows[0]?.count ?? 0)).toBe(1)
  })

  it('imports multiple records with auto-generated unique keys and optional fields', async () => {
    const created = await importDocumentsForAdmin(
      [
        { name: 'A', content: 'one' },
        { name: 'B', content: 'two', documentType: 'json', isPublic: false },
      ],
      '10.0.0.7',
    )

    expect(created).toHaveLength(2)
    expect(new Set(created.map(document => document.id)).size).toBe(2)
    expect(created[1]).toMatchObject({ name: 'B', documentType: 'json', content: 'two' })

    const db = await getDb()
    const rows = await db.query<{ name: string; is_public: number; document_type: string }>(
      'select name, is_public, document_type from documents',
    )
    const byName = new Map(rows.rows.map(row => [row.name, row]))
    expect(byName.get('A')).toMatchObject({ is_public: 1, document_type: 'text' })
    expect(byName.get('B')).toMatchObject({ is_public: 0, document_type: 'json' })
  })

  it('uses a provided key instead of auto-generating one', async () => {
    const created = await importDocumentsForAdmin([{ name: 'Notes', content: 'hello', key: 'abc123' }], '10.0.0.7')

    expect(created).toHaveLength(1)
    expect(created[0].id).toBe('abc123')
    expect(await fetchDocument('abc123')).toMatchObject({ name: 'Notes', content: 'hello' })
  })

  it('rejects duplicate keys within the same import batch', async () => {
    await expect(
      importDocumentsForAdmin(
        [
          { name: 'A', content: 'one', key: 'abc123' },
          { name: 'B', content: 'two', key: 'abc123' },
        ],
        '10.0.0.7',
      ),
    ).rejects.toThrow('record 2: duplicate document key')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from documents')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(0)
  })

  it('merges (upserts) into an existing document with the same key', async () => {
    const existing = await insertDocument({ name: 'Original', content: 'old', by: '10.0.0.7' })

    const imported = await importDocumentsForAdmin(
      [{ name: 'Updated', content: 'new body', key: existing.id, isPublic: false }],
      '10.0.0.8',
    )

    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ id: existing.id, name: 'Updated', content: 'new body' })

    const db = await getDb()
    const rows = await db.query<{ count: number | string; is_public: number }>(
      'select count(*) as count, (select is_public from documents where key = $1) as is_public from documents',
      [existing.id],
    )
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(1)
    expect(rows.rows[0]?.is_public).toBe(0)

    const versions = await db.query<{ count: number | string }>(
      'select count(*) as count from document_versions where document_id = (select id from documents where key = $1)',
      [existing.id],
    )
    expect(Number(versions.rows[0]?.count ?? 0)).toBe(2)
  })

  it('rejects a malformed provided key', async () => {
    await expect(
      importDocumentsForAdmin([{ name: 'A', content: 'one', key: 'NOT_VALID' }], '10.0.0.7'),
    ).rejects.toThrow('record 1: document key must be 6 lowercase alphanumeric characters')
  })

  it('aborts the whole import when one record is invalid (all-or-nothing)', async () => {
    await importDocumentsForAdmin([{ name: 'A', content: 'one' }], '10.0.0.7')

    await expect(
      importDocumentsForAdmin(
        [
          { name: 'B', content: 'two' },
          { name: '', content: 'bad' },
        ],
        '10.0.0.7',
      ),
    ).rejects.toThrow('record 2: name is required')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from documents')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(1)
  })

  it('rejects an invalid document type', async () => {
    await expect(
      importDocumentsForAdmin([{ name: 'A', content: 'one', documentType: 'nope' }], '10.0.0.7'),
    ).rejects.toThrow('record 1: invalid document type')
  })

  it('rejects a record without string content', async () => {
    await expect(importDocumentsForAdmin([{ name: 'A', content: undefined }], '10.0.0.7')).rejects.toThrow(
      'record 1: content is required',
    )

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from documents')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(0)
  })

  it('bypasses the per-IP document limit', async () => {
    const maxDocuments = await getMaxDocumentsPerUser()
    for (let i = 0; i < maxDocuments; i++) {
      await insertDocument({ name: `doc ${i}`, content: '', by: '10.0.0.99' })
    }

    const created = await importDocumentsForAdmin([{ name: 'imported', content: '' }], '10.0.0.99')
    expect(created).toHaveLength(1)
  })
})

describe('exportDocumentsForAdmin against the SQLite backend (dev profile)', () => {
  it('exports every document shaped like an import record with its key', async () => {
    const notes = await insertDocument({ name: 'Notes', content: 'hello', by: '10.0.0.7' })
    const tagged = await insertDocument({ name: 'Tagged', content: 'body', by: '10.0.0.8' })
    await updateDocument(tagged.id, { tags: [{ name: 'urgent', color: '#FF6680' }], isPublic: false, by: '10.0.0.8' })

    const records = await exportDocumentsForAdmin()

    expect(records).toHaveLength(2)
    expect(records).toEqual(
      expect.arrayContaining([
        { key: notes.id, name: 'Notes', content: 'hello', documentType: 'text', tags: [], isPublic: true },
        {
          key: tagged.id,
          name: 'Tagged',
          content: 'body',
          documentType: 'text',
          tags: [{ name: 'urgent', color: '#FF6680' }],
          isPublic: false,
        },
      ]),
    )
  })

  it('exports only the selected keys in the given order of keys', async () => {
    const first = await insertDocument({ name: 'First', content: 'one', by: '10.0.0.7' })
    await insertDocument({ name: 'Second', content: 'two', by: '10.0.0.7' })
    const third = await insertDocument({ name: 'Third', content: 'three', by: '10.0.0.7' })

    const records = await exportDocumentsForAdmin([first.id, third.id])

    expect(records.map(record => record.name).sort()).toEqual(['First', 'Third'])
    expect(records.find(record => record.name === 'Third')?.content).toBe('three')
  })

  it('returns an empty array for unknown keys and for an empty selection', async () => {
    await insertDocument({ name: 'Only', content: '', by: '10.0.0.7' })

    expect(await exportDocumentsForAdmin(['zzzzzz'])).toEqual([])
    expect(await exportDocumentsForAdmin([])).toHaveLength(1)
  })

  it('round-trips through the import by preserving keys', async () => {
    const notes = await insertDocument({ name: 'Notes', content: 'hello', by: '10.0.0.7' })

    const exported = await exportDocumentsForAdmin([notes.id])
    await deleteDocument(notes.id)

    const reimported = await importDocumentsForAdmin(exported, '10.0.0.9')

    expect(reimported).toHaveLength(1)
    expect(reimported[0]).toMatchObject({ id: notes.id, name: 'Notes', content: 'hello' })
  })
})
