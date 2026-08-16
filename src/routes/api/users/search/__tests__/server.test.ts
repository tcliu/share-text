import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({ isAdminSession: vi.fn() }))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    isAdminSession: authMocks.isAdminSession,
  }
})

const usersMocks = vi.hoisted(() => ({ searchUsers: vi.fn() }))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    searchUsers: usersMocks.searchUsers,
  }
})

import { GET } from '../+server'

const event = (query: string) =>
  ({
    url: new URL(`http://localhost/api/users/search?q=${encodeURIComponent(query)}`),
    cookies: { get: () => null },
  }) as never

describe('GET /api/users/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without an admin session', async () => {
    authMocks.isAdminSession.mockReturnValue(false)

    const response = await GET(event('ali'))

    expect(response.status).toBe(401)
    expect(usersMocks.searchUsers).not.toHaveBeenCalled()
  })

  it('searches all users including inactive for an admin', async () => {
    authMocks.isAdminSession.mockReturnValue(true)
    usersMocks.searchUsers.mockResolvedValue([
      { id: 2, username: 'bob', email: 'bob@example.com', status: 'inactive' },
    ])

    const response = await GET(event('bob'))

    expect(usersMocks.searchUsers).toHaveBeenCalledWith('bob', 10, true)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      users: [{ id: 2, username: 'bob', email: 'bob@example.com', status: 'inactive' }],
    })
  })

  it('returns an empty list for an empty query', async () => {
    authMocks.isAdminSession.mockReturnValue(true)

    const response = await GET(event(''))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ users: [] })
    expect(usersMocks.searchUsers).not.toHaveBeenCalled()
  })
})
