import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  resolveDocumentAccess: vi.fn(),
  fetchDocumentVersions: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    resolveDocumentAccess: documentsMocks.resolveDocumentAccess,
    fetchDocumentVersions: documentsMocks.fetchDocumentVersions,
  }
})

import { GET } from '../+server'

const event = {
  params: { id: 'a1b2c3' },
  getClientAddress: () => '127.0.0.1',
  cookies: { get: () => null },
}

describe('GET /api/documents/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document: { id: 'a1b2c3' },
      canView: true,
      canEdit: true,
      canDelete: true,
    })
  })

  it('returns 404 for an invalid document id', async () => {
    const response = await GET({ ...event, params: { id: 'not-a-key!' } } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.resolveDocumentAccess).not.toHaveBeenCalled()
  })

  it('returns 404 when the document does not exist', async () => {
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document: null,
      canView: false,
      canEdit: false,
      canDelete: false,
    })

    const response = await GET(event as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.fetchDocumentVersions).not.toHaveBeenCalled()
  })

  it('returns the version list for an existing document', async () => {
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

    const response = await GET(event as never)

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
