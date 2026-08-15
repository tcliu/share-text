import { beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_SESSION_COOKIE } from '$lib/server/user-auth'

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  getAdminUsername: vi.fn(),
  getCurrentUserId: vi.fn(),
  findUserById: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', () => ({
  getAdminUsername: mocks.getAdminUsername,
  isAdminSession: mocks.isAdminSession,
}))

vi.mock('$lib/server/user-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/user-auth')>('$lib/server/user-auth')
  return {
    ...actual,
    getCurrentUserId: mocks.getCurrentUserId,
  }
})

vi.mock('$lib/server/users', () => ({
  findUserById: mocks.findUserById,
}))

import { GET } from '../+server'

function getEvent() {
  const deleted: string[] = []
  const cookies = {
    get: () => 'token',
    delete: (name: string) => {
      deleted.push(name)
    },
  }
  return { event: { cookies } as never, deleted }
}

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isAdminSession.mockReturnValue(false)
    mocks.getAdminUsername.mockReturnValue('admin')
    mocks.getCurrentUserId.mockReturnValue(null)
    mocks.findUserById.mockResolvedValue(null)
  })

  it('reports only an admin session when no user session is present', async () => {
    mocks.isAdminSession.mockReturnValue(true)
    const { event } = getEvent()

    const response = await GET(event)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user: null, admin: { username: 'admin' } })
  })

  it('reports a signed-in user', async () => {
    mocks.getCurrentUserId.mockReturnValue(7)
    mocks.findUserById.mockResolvedValue({ id: 7, username: 'alice', email: 'alice@example.com' })
    const { event } = getEvent()

    const response = await GET(event)

    await expect(response.json()).resolves.toEqual({
      user: { id: 7, username: 'alice', email: 'alice@example.com' },
      admin: null,
    })
  })

  it('drops the user session cookie and reports signed out for an inactive user', async () => {
    mocks.getCurrentUserId.mockReturnValue(7)
    mocks.findUserById.mockResolvedValue({ id: 7, username: 'alice', email: 'alice@example.com', status: 'inactive' })
    const { event, deleted } = getEvent()

    const response = await GET(event)

    expect(deleted).toContain(USER_SESSION_COOKIE)
    await expect(response.json()).resolves.toEqual({ user: null, admin: null })
  })

  it('reports signed out when no session is present', async () => {
    const { event } = getEvent()

    const response = await GET(event)

    await expect(response.json()).resolves.toEqual({ user: null, admin: null })
  })
})
