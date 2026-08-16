import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({ getCurrentUserId: vi.fn() }))

vi.mock('$lib/server/user-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/user-auth')>('$lib/server/user-auth')
  return {
    ...actual,
    getCurrentUserId: authMocks.getCurrentUserId,
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

const event = () => ({ cookies: { get: () => null } }) as never

describe('GET /api/users/recent-sharees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without a user session', async () => {
    authMocks.getCurrentUserId.mockReturnValue(null)

    const response = await GET(event())

    expect(response.status).toBe(401)
    expect(usersMocks.listRecentSharees).not.toHaveBeenCalled()
  })

  it('returns the users the current user has previously shared with', async () => {
    authMocks.getCurrentUserId.mockReturnValue(1)
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
})
