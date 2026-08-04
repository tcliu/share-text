import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  listDocumentsForAdmin: vi.fn(),
  fetchDocumentForAdmin: vi.fn(),
  fetchDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    listDocumentsForAdmin: documentsMocks.listDocumentsForAdmin,
    fetchDocumentForAdmin: documentsMocks.fetchDocumentForAdmin,
    fetchDocument: documentsMocks.fetchDocument,
    deleteDocument: documentsMocks.deleteDocument,
    updateDocument: documentsMocks.updateDocument,
  }
})

import { GET } from '../documents/+server'
import { DELETE, PUT } from '../documents/[id]/+server'

const summary = {
  id: 'a1b2c3',
  name: 'Notes',
  createdBy: '10.0.0.1',
  updatedBy: '10.0.0.2',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  contentSize: 12,
}

describe('GET /api/admin/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.listDocumentsForAdmin.mockResolvedValue({ documents: [summary], total: 1, hasMore: false })
  })

  it('returns paginated documents with total', async () => {
    const response = await GET({
      url: new URL('http://localhost/api/admin/documents?search=notes&limit=20&offset=0'),
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith({
      search: 'notes',
      searchKeys: [],
      by: '',
      limit: 20,
      offset: 0,
      sortBy: undefined,
      order: undefined,
    })
    await expect(response.json()).resolves.toEqual({ documents: [summary], total: 1, hasMore: false })
  })

  it('forwards searchKeys as a list of column keys', async () => {
    const response = await GET({
      url: new URL('http://localhost/api/admin/documents?search=alpha&search-keys=id,name,updatedBy'),
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alpha', searchKeys: ['id', 'name', 'updatedBy'] }),
    )
  })

  it('forwards sortBy and order parameters', async () => {
    const response = await GET({ url: new URL('http://localhost/api/admin/documents?sortBy=name&order=asc') } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', order: 'asc' }),
    )
  })

  it('ignores an invalid order parameter', async () => {
    const response = await GET({ url: new URL('http://localhost/api/admin/documents?sortBy=name&order=sideways') } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', order: undefined }),
    )
  })

  it('rejects invalid pagination parameters', async () => {
    const response = await GET({ url: new URL('http://localhost/api/admin/documents?limit=abc') } as never)
    expect(response.status).toBe(400)
  })
})

describe('PUT /api/admin/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentForAdmin.mockResolvedValue({ ...summary, content: 'hello world' })
    documentsMocks.updateDocument.mockResolvedValue({
      id: 'a1b2c3',
      name: 'Renamed',
      content: 'hello world',
      updatedAt: '2026-08-03T00:00:00.000Z',
      updatedBy: '203.0.113.9',
    })
  })

  it('renames a document and returns the refreshed admin view', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', { name: 'Renamed', by: '203.0.113.9' })
    await expect(response.json()).resolves.toEqual({
      document: {
        id: 'a1b2c3',
        name: 'Renamed',
        createdBy: '10.0.0.1',
        updatedBy: '203.0.113.9',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
        contentSize: 11,
        content: 'hello world',
      },
    })
  })

  it('returns 400 when the name is missing', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)
    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/admin/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocument.mockResolvedValue({ ...summary, content: 'hello world' })
    documentsMocks.deleteDocument.mockResolvedValue(true)
  })

  it('deletes a document', async () => {
    const response = await DELETE({ params: { id: 'a1b2c3' }, getClientAddress: () => '203.0.113.9' } as never)
    expect(response.status).toBe(204)
    expect(documentsMocks.deleteDocument).toHaveBeenCalledWith('a1b2c3')
  })

  it('returns 404 when the document is missing', async () => {
    documentsMocks.fetchDocument.mockResolvedValue(null)
    const response = await DELETE({ params: { id: 'a1b2c3' }, getClientAddress: () => '203.0.113.9' } as never)
    expect(response.status).toBe(404)
  })
})
