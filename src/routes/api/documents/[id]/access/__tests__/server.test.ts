import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentMocks = vi.hoisted(() => ({
  resolveDocumentAccess: vi.fn(),
  getDocumentAccess: vi.fn(),
  missingSharees: vi.fn(),
  setDocumentAccess: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    resolveDocumentAccess: documentMocks.resolveDocumentAccess,
    getDocumentAccess: documentMocks.getDocumentAccess,
    missingSharees: documentMocks.missingSharees,
    setDocumentAccess: documentMocks.setDocumentAccess,
  }
})

const viewerMocks = vi.hoisted(() => ({ resolveViewer: vi.fn() }))

vi.mock('$lib/server/viewer', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/viewer')>('$lib/server/viewer')
  return {
    ...actual,
    resolveViewer: viewerMocks.resolveViewer,
  }
})

vi.mock('$lib/server/logging', () => ({ logEvent: vi.fn() }))

import { GET, PUT } from '../+server'

const baseEvent = () =>
  ({
    params: { id: 'a1b2c3' },
    getClientAddress: () => '127.0.0.1',
    cookies: { get: () => null },
  }) as unknown as Parameters<typeof PUT>[0]

function accessFor(canManageAccess: boolean) {
  return {
    document: { id: 'a1b2c3' },
    canView: true,
    canEdit: true,
    canDelete: true,
    canManageAccess,
  }
}

const userViewer = () => ({ type: 'user', userId: 1, username: 'alice', ip: '127.0.0.1', name: 'alice' })
const adminViewer = () => ({ type: 'admin', userId: null, ip: '127.0.0.1', name: 'admin' })

const bobUser = () => ({ id: 2, username: 'bob', email: 'bob@example.com', status: 'active' as const })

describe('PUT /api/documents/[id]/access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())
    documentMocks.resolveDocumentAccess.mockResolvedValue(accessFor(true))
    documentMocks.missingSharees.mockResolvedValue([])
    documentMocks.setDocumentAccess.mockResolvedValue({
      isPublic: false,
      sharedWith: [bobUser()],
    })
  })

  it('rejects when the viewer cannot manage access', async () => {
    documentMocks.resolveDocumentAccess.mockResolvedValue(accessFor(false))

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob'] }),
      }),
    })

    expect(response.status).toBe(403)
    expect(documentMocks.setDocumentAccess).not.toHaveBeenCalled()
  })

  it('rejects the whole update when any sharee cannot be resolved for a normal user', async () => {
    documentMocks.missingSharees.mockResolvedValue(['nobody'])

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob', 'nobody'] }),
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Not shared: nobody',
      missing: ['nobody'],
    })
    expect(documentMocks.setDocumentAccess).not.toHaveBeenCalled()
  })

  it('rejects non-string sharedWith entries', async () => {
    const response = await PUT({
      params: { id: 'a1b2c3' },
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: [123] }),
      }),
      cookies: { get: () => null },
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'sharedWith must be an array of strings' })
    expect(documentMocks.setDocumentAccess).not.toHaveBeenCalled()
  })

  it('resolves sharees including inactive users for an admin', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(adminViewer())

    await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob'] }),
      }),
    })

    expect(documentMocks.setDocumentAccess).toHaveBeenCalledWith(
      'a1b2c3',
      { isPublic: undefined, sharedWith: ['bob'] },
      { includeInactive: true },
    )
  })

  it('accepts a resolved email as a valid sharee', async () => {
    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob@example.com'] }),
      }),
    })

    expect(response.status).toBe(200)
    expect(documentMocks.setDocumentAccess).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      isPublic: false,
      sharedWith: [bobUser()],
    })
  })
})

describe('GET /api/documents/[id]/access', () => {
  it('returns the access state without a missing field', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())
    documentMocks.resolveDocumentAccess.mockResolvedValue(accessFor(true))
    documentMocks.getDocumentAccess.mockResolvedValue({
      isPublic: true,
      sharedWith: [],
    })

    const response = await GET(baseEvent())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ isPublic: true, sharedWith: [] })
  })
})