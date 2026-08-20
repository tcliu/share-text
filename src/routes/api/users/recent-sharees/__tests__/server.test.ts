import { beforeEach, describe, expect, it, vi } from 'vitest'

const viewerMocks = vi.hoisted(() => ({ resolveViewer: vi.fn() }))

vi.mock('$lib/server/viewer', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/viewer')>('$lib/server/viewer')
  return {
    ...actual,
    resolveViewer: viewerMocks.resolveViewer,
  }
})

const usersMocks = vi.hoisted(() => ({ listRecentSharees: vi.fn() }))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    listRecentSharees: usersMocks.listRecentSharees,
  }
})

import { GET } from '../+server'

const event = () => ({ cookies: { get: () => null }, getClientAddress: () => '127.0.0.1' }) as never

describe('GET /api/users/recent-sharees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without a user session', async () => {
    viewerMocks.resolveViewer.mockResolvedValue({ type: 'anonymous', userId: null, username: null, ip: '127.0.0.1', name: '127.0.0.1' })

    const response = await GET(event())

    expect(response.status).toBe(401)
    expect(usersMocks.listRecentSharees).not.toHaveBeenCalled()
  })

  it('returns the users the current user has previously shared with', async () => {
    viewerMocks.resolveViewer.mockResolvedValue({ type: 'user', userId: 1, username: 'alice', ip: '127.0.0.1', name: 'alice' })
    usersMocks.listRecentSharees.mockResolvedValue([
      { id: 2, username: 'bob', email: 'bob@example.com', status: 'active' },
    ])

    const response = await GET(event())

    expect(usersMocks.listRecentSharees).toHaveBeenCalledWith(1)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      users: [{ id: 2, username: 'bob', email: 'bob@example.com', status: 'active' }],
    })
  })

  it('rejects admin sessions', async () => {
    viewerMocks.resolveViewer.mockResolvedValue({ type: 'admin', userId: null, ip: '127.0.0.1', name: 'admin' })

    const response = await GET(event())

    expect(response.status).toBe(401)
    expect(usersMocks.listRecentSharees).not.toHaveBeenCalled()
  })
})
