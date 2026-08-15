import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  listDocumentsForAdmin: vi.fn(),
  fetchDocumentForAdmin: vi.fn(),
  fetchDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  normalizeDocumentKey: vi.fn(),
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
    normalizeDocumentKey: documentsMocks.normalizeDocumentKey,
  }
})

const settingsMocks = vi.hoisted(() => ({
  getMaxContentLength: vi.fn(),
}))

vi.mock('$lib/server/settings', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/settings')>('$lib/server/settings')
  return {
    ...actual,
    getMaxContentLength: settingsMocks.getMaxContentLength,
  }
})

import { GET as listGET } from '../documents/+server'
import { DELETE, GET, PUT } from '../documents/[id]/+server'

const summary = {
  id: 'a1b2c3',
  name: 'Notes',
  documentType: 'text',
  tags: [{ name: 'alpha', color: '#00F0FF' }],
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
    const response = await listGET({
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
    const response = await listGET({
      url: new URL('http://localhost/api/admin/documents?search=alpha&search-keys=id,name,updatedBy'),
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alpha', searchKeys: ['id', 'name', 'updatedBy'] }),
    )
  })

  it('forwards sortBy and order parameters', async () => {
    const response = await listGET({ url: new URL('http://localhost/api/admin/documents?sortBy=name&order=asc') } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', order: 'asc' }),
    )
  })

  it('ignores an invalid order parameter', async () => {
    const response = await listGET({ url: new URL('http://localhost/api/admin/documents?sortBy=name&order=sideways') } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.listDocumentsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', order: undefined }),
    )
  })

  it('rejects invalid pagination parameters', async () => {
    const response = await listGET({ url: new URL('http://localhost/api/admin/documents?limit=abc') } as never)
    expect(response.status).toBe(400)
  })
})

describe('GET /api/admin/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentForAdmin.mockResolvedValue({ ...summary, content: 'hello world' })
  })

  it('returns the document with its content', async () => {
    const response = await GET({ params: { id: 'a1b2c3' } } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.fetchDocumentForAdmin).toHaveBeenCalledWith('a1b2c3')
    await expect(response.json()).resolves.toEqual({
      document: { ...summary, content: 'hello world' },
    })
  })

  it('returns 404 when the document is missing', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce(null)
    const response = await GET({ params: { id: 'a1b2c3' } } as never)
    expect(response.status).toBe(404)
  })
})

describe('PUT /api/admin/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentForAdmin.mockResolvedValue({ ...summary, content: 'hello world' })
    documentsMocks.normalizeDocumentKey.mockImplementation(async (value: string) => value.toLowerCase())
    settingsMocks.getMaxContentLength.mockResolvedValue(1024 * 1024)
    documentsMocks.updateDocument.mockResolvedValue({
      id: 'a1b2c3',
      name: 'Renamed',
      content: 'hello world',
      documentType: 'text',
      tags: [{ name: 'alpha', color: '#00F0FF' }],
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
  tags: [{ name: 'alpha', color: '#00F0FF' }],
        documentType: 'text',
        createdBy: '10.0.0.1',
        updatedBy: '203.0.113.9',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
        contentSize: 11,
        content: 'hello world',
      },
    })
  })

  it('updates the updatedBy attribution', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    documentsMocks.updateDocument.mockResolvedValueOnce({
      id: 'a1b2c3',
      name: 'Notes',
      content: 'hello world',
      documentType: 'text',
      tags: [{ name: 'alpha', color: '#00F0FF' }],
      updatedAt: '2026-08-03T00:00:00.000Z',
      updatedBy: '203.0.113.10',
    })
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updatedBy: '203.0.113.10' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', {
      updatedBy: '203.0.113.10',
      by: '203.0.113.9',
    })
  })

  it('returns 400 when the body has neither a name nor updatedBy', async () => {
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

  it('returns 400 when updatedBy is blank', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updatedBy: '   ' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)
    expect(response.status).toBe(400)
  })

  it('updates the createdBy attribution', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ createdBy: 'admin@example.com' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', {
      createdBy: 'admin@example.com',
      by: '203.0.113.9',
    })
    const body = (await response.json()) as { document: { createdBy: string } }
    expect(body.document.createdBy).toBe('admin@example.com')
  })

  it('updates the document key', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'zzz999' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', { key: 'zzz999', by: '203.0.113.9' })
  })

  it('returns 409 when the new key collides with an existing document', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    documentsMocks.updateDocument.mockRejectedValueOnce(new Error('UNIQUE constraint failed: documents.key'))
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'zzz999' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)
    expect(response.status).toBe(409)
  })

  it('updates the document content', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    documentsMocks.updateDocument.mockResolvedValueOnce({
      id: 'a1b2c3',
      name: 'Notes',
      content: 'hello world!',
      documentType: 'text',
      tags: [],
      updatedAt: '2026-08-03T00:00:00.000Z',
      updatedBy: '203.0.113.9',
    })
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'hello world!' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', {
      content: 'hello world!',
      by: '203.0.113.9',
    })
    const body = (await response.json()) as { document: { content: string; contentSize: number } }
    expect(body.document.content).toBe('hello world!')
    expect(body.document.contentSize).toBe(12)
  })

  it('returns 400 when the content exceeds the configured limit', async () => {
    documentsMocks.fetchDocumentForAdmin.mockResolvedValueOnce({ ...summary, content: 'hello world' })
    settingsMocks.getMaxContentLength.mockResolvedValueOnce(5)
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'a very long content' }),
      }),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(400)
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('returns 400 when the new key has an invalid format', async () => {
    documentsMocks.normalizeDocumentKey.mockRejectedValueOnce(
      new Error('document key must be 6 lowercase alphanumeric characters'),
    )
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/admin/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'not-a-key' }),
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
