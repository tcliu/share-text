import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDocument,
  deleteDocument,
  fetchDocument,
  fetchDocumentSummaries,
  updateDocument,
} from '$lib/documents'

const summary = { id: 'a1b2c3', name: 'Notes', updatedAt: '2026-08-02T12:00:00.000Z' }

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchDocumentSummaries', () => {
  it('returns the document list', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, status: 200, body: { documents: [summary], hasMore: false } }))
    expect(await fetchDocumentSummaries()).toEqual({ documents: [summary], hasMore: false })
  })

  it('throws on error responses', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 500, body: {} }))
    await expect(fetchDocumentSummaries()).rejects.toThrow('Failed to load documents')
  })

  it('passes limit and offset parameters', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { documents: [summary], hasMore: true } })
    vi.stubGlobal('fetch', fetchMock)
    await fetchDocumentSummaries(20, 40)
    expect(fetchMock).toHaveBeenCalledWith('/api/documents?limit=20&offset=40')
  })
})

describe('fetchDocument', () => {
  it('returns a document', async () => {
    const document = { ...summary, content: 'body' }
    vi.stubGlobal('fetch', mockFetch({ ok: true, status: 200, body: { document } }))
    expect(await fetchDocument(document.id)).toEqual(document)
  })

  it('returns null for 404 responses', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 404, body: {} }))
    expect(await fetchDocument(summary.id)).toBeNull()
  })
})

describe('createDocument', () => {
  it('POSTs an empty payload and returns the document', async () => {
    const document = { ...summary, content: '' }
    const fetchMock = mockFetch({ ok: true, status: 201, body: { document } })
    vi.stubGlobal('fetch', fetchMock)
    expect(await createDocument()).toEqual(document)
    expect(fetchMock).toHaveBeenCalledWith('/api/documents', expect.objectContaining({ method: 'POST' }))
  })
})

describe('updateDocument', () => {
  it('PUTs the name and content', async () => {
    const document = { ...summary, content: 'new' }
    const fetchMock = mockFetch({ ok: true, status: 200, body: { document } })
    vi.stubGlobal('fetch', fetchMock)
    expect(await updateDocument(summary.id, { name: 'Notes', content: 'new' })).toEqual(document)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/documents/${summary.id}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Notes', content: 'new' }),
      }),
    )
  })
})

describe('deleteDocument', () => {
  it('resolves on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, status: 204, body: null }))
    await expect(deleteDocument(summary.id)).resolves.toBeUndefined()
  })

  it('throws on error responses', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 404, body: {} }))
    await expect(deleteDocument(summary.id)).rejects.toThrow('Failed to delete document')
  })
})
