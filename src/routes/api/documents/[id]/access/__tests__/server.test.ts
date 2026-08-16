import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  resolveDocumentAccess: vi.fn(),
  getDocumentAccess: vi.fn(),
  setDocumentAccess: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    resolveDocumentAccess: documentsMocks.resolveDocumentAccess,
    getDocumentAccess: documentsMocks.getDocumentAccess,
    setDocumentAccess: documentsMocks.setDocumentAccess,
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

const loggingMocks = vi.hoisted(() => ({ logEvent: vi.fn() }))

vi.mock('$lib/server/logging', () => ({ logEvent: loggingMocks.logEvent }))

const usersMocks = vi.hoisted(() => ({ findUsersByUsernameOrEmail: vi.fn() }))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    findUsersByUsernameOrEmail: usersMocks.findUsersByUsernameOrEmail,
  }
})

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

function resolveFor(values: string[]) {
  return Promise.resolve(
    values.filter(value => {
      const normalized = value.trim().toLowerCase()
      return normalized === 'bob' || normalized === 'bob@example.com'
    }).map(bobUser),
  )
}

describe('PUT /api/documents/[id]/access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.resolveDocumentAccess.mockResolvedValue(accessFor(true))
    documentsMocks.setDocumentAccess.mockResolvedValue({
      isPublic: false,
      sharedWith: [bobUser()],
    })
    usersMocks.findUsersByUsernameOrEmail.mockImplementation(resolveFor)
  })

  it('rejects when the viewer cannot manage access', async () => {
    documentsMocks.resolveDocumentAccess.mockResolvedValue(accessFor(false))
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob'] }),
      }),
    })

    expect(response.status).toBe(403)
    expect(documentsMocks.setDocumentAccess).not.toHaveBeenCalled()
  })

  it('rejects the whole update when any sharee cannot be resolved for a normal user', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())

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
    expect(documentsMocks.setDocumentAccess).not.toHaveBeenCalled()
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

    expect(documentsMocks.setDocumentAccess).toHaveBeenCalledWith(
      'a1b2c3',
      { isPublic: undefined, sharedWith: ['bob'] },
      { includeInactive: true },
    )
  })

  it('accepts a resolved email as a valid sharee', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/documents/a1b2c3/access', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sharedWith: ['bob@example.com'] }),
      }),
    })

    expect(response.status).toBe(200)
    expect(documentsMocks.setDocumentAccess).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      isPublic: false,
      sharedWith: [bobUser()],
    })
  })
})

describe('GET /api/documents/[id]/access', () => {
  it('returns the access state without a missing field', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())
    documentsMocks.resolveDocumentAccess.mockResolvedValue(accessFor(true))
    documentsMocks.getDocumentAccess.mockResolvedValue({
      isPublic: true,
      sharedWith: [],
    })

    const response = await GET(baseEvent())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ isPublic: true, sharedWith: [] })
  })
})
