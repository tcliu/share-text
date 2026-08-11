import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  fetchDocument: vi.fn(),
  fetchDocumentVersions: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    fetchDocument: documentsMocks.fetchDocument,
    fetchDocumentVersions: documentsMocks.fetchDocumentVersions,
  }
})

import { GET } from '../+server'

describe('GET /api/documents/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for an invalid document id', async () => {
    const response = await GET({ params: { id: 'not-a-key!' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocument).not.toHaveBeenCalled()
  })

  it('returns 404 when the document does not exist', async () => {
    documentsMocks.fetchDocument.mockResolvedValue(null)

    const response = await GET({ params: { id: 'a1b2c3' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocumentVersions).not.toHaveBeenCalled()
  })

  it('returns the version list for an existing document', async () => {
    documentsMocks.fetchDocument.mockResolvedValue({ id: 'a1b2c3' })
    documentsMocks.fetchDocumentVersions.mockResolvedValue([
      {
        id: '2',
        documentId: 'a1b2c3',
        documentType: 'markdown',
        updatedBy: '203.0.113.7',
        createdAt: '2026-08-03T00:00:00.000Z',
        contentSize: 12,
      },
    ])

    const response = await GET({ params: { id: 'a1b2c3' } } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.fetchDocumentVersions).toHaveBeenCalledWith('a1b2c3')
    await expect(response.json()).resolves.toEqual({
      versions: [
        {
          id: '2',
          documentId: 'a1b2c3',
          documentType: 'markdown',
          updatedBy: '203.0.113.7',
          createdAt: '2026-08-03T00:00:00.000Z',
          contentSize: 12,
        },
      ],
    })
  })
})
