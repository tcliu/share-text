import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  updateDocument: vi.fn(),
  resolveDocumentAccess: vi.fn(),
}))

vi.mock('$lib/server/document-store', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/document-store')>('$lib/server/document-store')
  return {
    ...actual,
    updateDocument: documentsMocks.updateDocument,
  }
})

vi.mock('$lib/server/document-access', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/document-access')>('$lib/server/document-access')
  return {
    ...actual,
    resolveDocumentAccess: documentsMocks.resolveDocumentAccess,
  }
})

const settingsMocks = vi.hoisted(() => ({
  getDocumentKeyLength: vi.fn(),
  getMaxContentLength: vi.fn(),
}))

vi.mock('$lib/server/settings', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/settings')>('$lib/server/settings')
  return {
    ...actual,
    getDocumentKeyLength: settingsMocks.getDocumentKeyLength,
    getMaxContentLength: settingsMocks.getMaxContentLength,
  }
})

import { PUT } from '../+server'

describe('PUT /api/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsMocks.getDocumentKeyLength.mockResolvedValue(6)
    settingsMocks.getMaxContentLength.mockResolvedValue(1024 * 1024)
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document: {
        id: 'a1b2c3',
        name: 'Notes',
        content: 'body',
        documentType: 'text',
        tags: [],
        updatedAt: '',
        updatedBy: '',
      },
      canView: true,
      canEdit: true,
      canDelete: true,
    })
  })

  it('rejects non-object JSON payloads', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([]),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('rejects unsupported fields', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'bad' }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported fields in request body' })
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('rejects wrong-typed fields instead of silently dropping them', async () => {
    for (const body of [{ name: 5 }, { content: 5 }, { documentType: 5 }, { tags: 'alpha' }]) {
      const response = await PUT({
        params: { id: 'a1b2c3' },
        request: new Request('http://localhost/api/documents/a1b2c3', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        getClientAddress: () => '127.0.0.1',
      } as never)

      expect(response.status).toBe(400)
    }
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('rejects malformed tag entries instead of dropping them', async () => {
    for (const tags of [[{ name: 5 }], [42], [null]]) {
      const response = await PUT({
        params: { id: 'a1b2c3' },
        request: new Request('http://localhost/api/documents/a1b2c3', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tags }),
        }),
        getClientAddress: () => '127.0.0.1',
      } as never)

      expect(response.status).toBe(400)
    }
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('rejects payloads with neither name nor content nor tags', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Request body must include name, content, documentType, or tags',
    })
    expect(documentsMocks.updateDocument).not.toHaveBeenCalled()
  })

  it('accepts tags-only updates', async () => {
    const tags = [
      { name: 'alpha', color: '#00F0FF' },
      { name: 'beta', color: '#FF6680' },
    ]
    documentsMocks.updateDocument.mockResolvedValue({
      id: 'a1b2c3',
      name: 'Notes',
      content: 'body',
      documentType: 'text',
      tags,
      updatedAt: '2026-08-03T00:00:00.000Z',
      updatedBy: '127.0.0.1',
    })

    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/documents/a1b2c3', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tags }),
      }),
      getClientAddress: () => '127.0.0.1',
      cookies: { get: () => null },
    } as never)

    expect(response.status).toBe(200)
    expect(documentsMocks.updateDocument).toHaveBeenCalledWith('a1b2c3', {
      name: undefined,
      content: undefined,
      documentType: undefined,
      tags,
      by: '127.0.0.1',
    })
  })
})
