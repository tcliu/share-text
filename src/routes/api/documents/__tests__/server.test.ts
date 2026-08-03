import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  fetchDocumentSummaries: vi.fn(),
  insertDocument: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    fetchDocumentSummaries: documentsMocks.fetchDocumentSummaries,
    insertDocument: documentsMocks.insertDocument,
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

import { GET, POST } from '../+server'

describe('GET /api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentSummaries.mockResolvedValue([])
  })

  it('rejects invalid pagination parameters', async () => {
    const response = await GET({
      url: new URL('http://localhost/api/documents?limit=20abc&offset=-1'),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid pagination parameters' })
    expect(documentsMocks.fetchDocumentSummaries).not.toHaveBeenCalled()
  })

  it('passes the client IP and validated pagination to the data layer', async () => {
    documentsMocks.fetchDocumentSummaries.mockResolvedValue([
      { id: 'a1b2c3', name: 'Doc', updatedAt: '2026-08-03T00:00:00.000Z', updatedBy: '203.0.113.7' },
    ])

    const response = await GET({
      url: new URL('http://localhost/api/documents?limit=20&offset=40'),
      getClientAddress: () => '203.0.113.9',
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.fetchDocumentSummaries).toHaveBeenCalledWith({
      by: '203.0.113.9',
      limit: 20,
      offset: 40,
    })
    await expect(response.json()).resolves.toEqual({
      documents: [{ id: 'a1b2c3', name: 'Doc', updatedAt: '2026-08-03T00:00:00.000Z', updatedBy: '203.0.113.7' }],
      hasMore: false,
    })
  })
})

describe('POST /api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsMocks.getMaxContentLength.mockResolvedValue(1024 * 1024)
    documentsMocks.insertDocument.mockResolvedValue({
      id: 'a1b2c3',
      name: 'a1b2c3',
      content: '',
      updatedAt: '2026-08-03T00:00:00.000Z',
      updatedBy: '127.0.0.1',
    })
  })

  it('rejects non-object JSON payloads', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([]),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
  })

  it('rejects unsupported fields', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'bad' }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported fields in request body' })
  })

  it('creates a document without a name so the generated key becomes its name', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(201)
    expect(documentsMocks.insertDocument).toHaveBeenCalledWith({
      name: undefined,
      content: '',
      by: '127.0.0.1',
    })
    await expect(response.json()).resolves.toEqual({
      document: {
        id: 'a1b2c3',
        name: 'a1b2c3',
        content: '',
        updatedAt: '2026-08-03T00:00:00.000Z',
        updatedBy: '127.0.0.1',
      },
    })
  })

  it('normalizes and passes an explicit name', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '  Meeting notes  ' }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(201)
    expect(documentsMocks.insertDocument).toHaveBeenCalledWith({
      name: 'Meeting notes',
      content: '',
      by: '127.0.0.1',
    })
  })
})
