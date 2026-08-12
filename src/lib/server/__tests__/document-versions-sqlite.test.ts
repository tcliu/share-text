// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  deleteDocument,
  fetchDocumentVersion,
  fetchDocumentVersions,
  insertDocument,
  updateDocument,
} from '$lib/server/documents'
import { clearSettingsCache, getMaxDocumentVersions } from '$lib/server/settings'

beforeEach(async () => {
  const db = await getDb()
  await db.query('delete from document_versions')
  await db.query('delete from documents')
  delete process.env.MAX_DOCUMENT_VERSIONS
  clearSettingsCache()
})

describe('document version history against the SQLite backend (dev profile)', () => {
  it('records the creation state as the first version', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'v1', by: '10.0.0.1' })

    const versions = await fetchDocumentVersions(created.id)
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      documentId: created.id,
      documentType: 'text',
      updatedBy: '10.0.0.1',
      contentSize: 2,
    })
    expect(versions[0]).not.toHaveProperty('content')

    const detail = await fetchDocumentVersion(created.id, Number(versions[0].id))
    expect(detail).toMatchObject({ content: 'v1', updatedBy: '10.0.0.1' })
  })

  it('records a version when content changes', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'v1', by: '10.0.0.1' })
    expect(await fetchDocumentVersions(created.id)).toHaveLength(1)

    await updateDocument(created.id, { content: 'v2', by: '203.0.113.7' })

    const versions = await fetchDocumentVersions(created.id)
    expect(versions).toHaveLength(2)
    expect(versions[0]).toMatchObject({
      documentId: created.id,
      documentType: 'text',
      updatedBy: '203.0.113.7',
      contentSize: 2,
    })
    expect(versions[0]).not.toHaveProperty('content')

    const detail = await fetchDocumentVersion(created.id, Number(versions[0].id))
    expect(detail).toMatchObject({ id: versions[0].id, content: 'v2', updatedBy: '203.0.113.7' })
  })

  it('records a version when the document type changes', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    await updateDocument(created.id, { documentType: 'markdown', by: '10.0.0.1' })

    const versions = await fetchDocumentVersions(created.id)
    expect(versions).toHaveLength(2)
    expect(versions[0].documentType).toBe('markdown')
    expect(versions[1].documentType).toBe('text')
  })

  it('does not record a version for metadata-only updates', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    await updateDocument(created.id, { name: 'Renamed', by: '10.0.0.1' })
    await updateDocument(created.id, { tags: [{ name: 'x', color: '#FF6680' }], by: '10.0.0.1' })

    expect(await fetchDocumentVersions(created.id)).toHaveLength(1)
  })

  it('does not record a version when content is unchanged', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'body', by: '10.0.0.1' })

    expect(await fetchDocumentVersions(created.id)).toHaveLength(1)
  })

  it('lists versions newest first with metadata only', async () => {
    const created = await insertDocument({ name: 'Notes', content: '', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'one', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'two', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'three', by: '10.0.0.1' })

    const versions = await fetchDocumentVersions(created.id)
    expect(versions.map(version => version.contentSize)).toEqual([5, 3, 3, 0])
    versions.forEach(version => expect(version).not.toHaveProperty('content'))
  })

  it('returns the requested version with its content', async () => {
    const created = await insertDocument({ name: 'Notes', content: '', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'first', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'second', by: '10.0.0.1' })

    const versions = await fetchDocumentVersions(created.id)
    const first = versions.find(version => version.contentSize === 'first'.length)
    const detail = await fetchDocumentVersion(created.id, Number(first?.id))
    expect(detail?.content).toBe('first')
  })

  it('returns null for unknown versions or documents', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'body', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'v2', by: '10.0.0.1' })

    expect(await fetchDocumentVersion(created.id, 999999)).toBeNull()
    expect(await fetchDocumentVersion('zzzzzz', 1)).toBeNull()
  })

  it('prunes versions beyond the configured limit', async () => {
    process.env.MAX_DOCUMENT_VERSIONS = '2'
    clearSettingsCache()
    expect(await getMaxDocumentVersions()).toBe(2)

    const created = await insertDocument({ name: 'Notes', content: '', by: '10.0.0.1' })
    for (let i = 1; i <= 5; i++) {
      await updateDocument(created.id, { content: `content-${i}`, by: '10.0.0.1' })
    }

    const versions = await fetchDocumentVersions(created.id)
    expect(versions).toHaveLength(2)
    expect(versions.map(version => version.contentSize)).toEqual(['content-5'.length, 'content-4'.length])
  })

  it('deletes versions when the document is deleted', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'v1', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'v2', by: '10.0.0.1' })
    expect(await fetchDocumentVersions(created.id)).toHaveLength(2)

    expect(await deleteDocument(created.id)).toBe(true)
    expect(await fetchDocumentVersions(created.id)).toHaveLength(0)
  })

  it('keeps versions attached to the document when the key changes', async () => {
    const created = await insertDocument({ name: 'Notes', content: 'v1', by: '10.0.0.1' })
    await updateDocument(created.id, { content: 'v2', by: '10.0.0.1' })
    await updateDocument(created.id, { key: 'zzz999', by: '203.0.113.7' })

    expect(await fetchDocumentVersions('zzz999')).toHaveLength(2)
    expect(await fetchDocumentVersions(created.id)).toHaveLength(0)
    const migrated = await fetchDocumentVersions('zzz999')
    const detail = await fetchDocumentVersion('zzz999', Number(migrated[0].id))
    expect(detail?.content).toBe('v2')
  })
})
