import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  resolveDocumentAccess: vi.fn(),
}))

vi.mock('#lib/server/document-store.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/document-store.js')>('#lib/server/document-store.js')
  return {
    ...actual,
    updateDocument: documentsMocks.updateDocument,
    deleteDocument: documentsMocks.deleteDocument,
  }
})

const loggingMocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
}))

vi.mock('#lib/server/logging.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/logging.js')>('#lib/server/logging.js')
  return {
    ...actual,
    logEvent: loggingMocks.logEvent,
  }
})

vi.mock('#lib/server/document-access.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/document-access.js')>('#lib/server/document-access.js')
  return {
    ...actual,
    resolveDocumentAccess: documentsMocks.resolveDocumentAccess,
  }
})

const settingsMocks = vi.hoisted(() => ({
  getDocumentKeyLength: vi.fn(),
  getMaxContentLength: vi.fn(),
}))

vi.mock('#lib/server/admin-properties.js', async () => {
  const actual = await vi.importActual<typeof import('#lib/server/admin-properties.js')>('#lib/server/admin-properties.js')
  return {
    ...actual,
    getDocumentKeyLength: settingsMocks.getDocumentKeyLength,
    getMaxContentLength: settingsMocks.getMaxContentLength,
  }
})

import { DELETE, PUT } from '../+server'
import { ADMIN_SESSION_COOKIE, createSessionToken } from '#lib/server/admin-auth.js'

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

describe('DELETE /api/documents/[id]', () => {
  const document = {
    id: 'a1b2c3',
    name: 'Notes',
    content: 'body',
    documentType: 'text',
    tags: [],
    updatedAt: '',
    updatedBy: '',
  }

  function adminCookies() {
    return { get: (name: string) => (name === ADMIN_SESSION_COOKIE ? createSessionToken() : null) }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document,
      canView: true,
      canEdit: true,
      canDelete: true,
      canManageAccess: true,
    })
    documentsMocks.deleteDocument.mockResolvedValue(true)
  })

  it('deletes the document and logs the deletion', async () => {
    const response = await DELETE({
      params: { id: 'a1b2c3' },
      getClientAddress: () => '127.0.0.1',
      cookies: adminCookies(),
    } as never)

    expect(response.status).toBe(204)
    expect(documentsMocks.deleteDocument).toHaveBeenCalledWith('a1b2c3')
    expect(loggingMocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document_delete',
        details: expect.objectContaining({ id: 'a1b2c3', name: 'Notes' }),
      }),
    )
  })

  it('rejects an authenticated viewer without delete permission with 403', async () => {
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document,
      canView: true,
      canEdit: true,
      canDelete: false,
      canManageAccess: false,
    })

    const response = await DELETE({
      params: { id: 'a1b2c3' },
      getClientAddress: () => '127.0.0.1',
      cookies: adminCookies(),
    } as never)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'You do not have permission to delete this document' })
    expect(documentsMocks.deleteDocument).not.toHaveBeenCalled()
  })

  it('hides a forbidden document from an anonymous viewer behind 404', async () => {
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document,
      canView: false,
      canEdit: false,
      canDelete: false,
      canManageAccess: false,
    })

    const response = await DELETE({
      params: { id: 'a1b2c3' },
      getClientAddress: () => '127.0.0.1',
      cookies: { get: () => null },
    } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.deleteDocument).not.toHaveBeenCalled()
  })

  it('returns 404 when the document does not exist', async () => {
    documentsMocks.resolveDocumentAccess.mockResolvedValue({
      document: null,
      canView: false,
      canEdit: false,
      canDelete: false,
      canManageAccess: false,
    })

    const response = await DELETE({
      params: { id: 'a1b2c3' },
      getClientAddress: () => '127.0.0.1',
      cookies: adminCookies(),
    } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.deleteDocument).not.toHaveBeenCalled()
  })

  it('returns 404 for an invalid document key without touching access checks', async () => {
    const response = await DELETE({
      params: { id: 'not/valid' },
      getClientAddress: () => '127.0.0.1',
      cookies: adminCookies(),
    } as never)

    expect(response.status).toBe(404)
    expect(documentsMocks.resolveDocumentAccess).not.toHaveBeenCalled()
  })

  it('logs a delete error and rethrows when the store fails', async () => {
    documentsMocks.deleteDocument.mockRejectedValue(new Error('db down'))

    await expect(
      DELETE({
        params: { id: 'a1b2c3' },
        getClientAddress: () => '127.0.0.1',
        cookies: adminCookies(),
      } as never),
    ).rejects.toThrow('db down')

    expect(loggingMocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document_delete_error',
        details: expect.objectContaining({ id: 'a1b2c3', name: 'Notes', error: 'db down' }),
      }),
    )
  })
})
