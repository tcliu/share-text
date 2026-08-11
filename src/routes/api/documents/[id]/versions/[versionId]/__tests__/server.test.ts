import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  fetchDocument: vi.fn(),
  fetchDocumentVersion: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    fetchDocument: documentsMocks.fetchDocument,
    fetchDocumentVersion: documentsMocks.fetchDocumentVersion,
  }
})

import { GET } from '../+server'

describe('GET /api/documents/[id]/versions/[versionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for a malformed version id', async () => {
    const response = await GET({ params: { id: 'a1b2c3', versionId: 'not-a-number' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocument).not.toHaveBeenCalled()
  })

  it('returns 404 for a non-positive version id', async () => {
    const response = await GET({ params: { id: 'a1b2c3', versionId: '0' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocument).not.toHaveBeenCalled()
  })

  it('returns 404 for an invalid document id', async () => {
    const response = await GET({ params: { id: 'not-a-key!', versionId: '5' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocument).not.toHaveBeenCalled()
  })

  it('returns 404 when the document does not exist', async () => {
    documentsMocks.fetchDocument.mockResolvedValue(null)

    const response = await GET({ params: { id: 'a1b2c3', versionId: '5' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocumentVersion).not.toHaveBeenCalled()
  })

  it('returns 404 when the version does not exist', async () => {
    documentsMocks.fetchDocument.mockResolvedValue({ id: 'a1b2c3' })
    documentsMocks.fetchDocumentVersion.mockResolvedValue(null)

    const response = await GET({ params: { id: 'a1b2c3', versionId: '5' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocumentVersion).toHaveBeenCalledWith('a1b2c3', 5)
  })

  it('returns the version with content for an existing version', async () => {
    documentsMocks.fetchDocument.mockResolvedValue({ id: 'a1b2c3' })
    documentsMocks.fetchDocumentVersion.mockResolvedValue({
      id: '5',
      documentId: 'a1b2c3',
      documentType: 'markdown',
      updatedBy: '203.0.113.7',
      createdAt: '2026-08-03T00:00:00.000Z',
      contentSize: 12,
      content: '# hello',
    })

    const response = await GET({ params: { id: 'a1b2c3', versionId: '5' } } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.fetchDocumentVersion).toHaveBeenCalledWith('a1b2c3', 5)
    await expect(response.json()).resolves.toEqual({
      version: {
        id: '5',
        documentId: 'a1b2c3',
        documentType: 'markdown',
        updatedBy: '203.0.113.7',
        createdAt: '2026-08-03T00:00:00.000Z',
        contentSize: 12,
        content: '# hello',
      },
    })
  })
})
