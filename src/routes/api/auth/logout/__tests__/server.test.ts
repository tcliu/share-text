import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const USER_SESSION_COOKIE = 'share-text-user-session'
  const ADMIN_SESSION_COOKIE = 'share-text-admin-session'
  return {
    logEvent: vi.fn(),
    USER_SESSION_COOKIE,
    ADMIN_SESSION_COOKIE,
  }
})

vi.mock('$lib/server/logging', () => ({
  logEvent: mocks.logEvent,
}))

vi.mock('$lib/server/user-auth', () => ({
  USER_SESSION_COOKIE: mocks.USER_SESSION_COOKIE,
}))

vi.mock('$lib/server/admin-auth', () => ({
  ADMIN_SESSION_COOKIE: mocks.ADMIN_SESSION_COOKIE,
}))

import { POST } from '../+server'

function createCookies(initial: string[]) {
  const store = new Map(initial.map(name => [name, 'token']))
  return {
    store,
    cookies: {
      get: (name: string) => store.get(name) ?? undefined,
      delete: (name: string) => {
        store.delete(name)
      },
    },
  }
}

function postEvent(initialCookies: string[]) {
  const { store, cookies } = createCookies(initialCookies)
  return {
    event: {
      getClientAddress: () => '127.0.0.1',
      cookies,
    } as never,
    store,
  }
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears both the user and admin session cookies', async () => {
    const { event, store } = postEvent([mocks.USER_SESSION_COOKIE, mocks.ADMIN_SESSION_COOKIE])

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(store.has(mocks.USER_SESSION_COOKIE)).toBe(false)
    expect(store.has(mocks.ADMIN_SESSION_COOKIE)).toBe(false)
  })

  it('logs an admin logout when the admin session cookie was present', async () => {
    const { event } = postEvent([mocks.ADMIN_SESSION_COOKIE])

    await POST(event)

    expect(mocks.logEvent).toHaveBeenCalledWith({ ip: '127.0.0.1', action: 'admin_logout' })
  })

  it('logs a user logout when only the user session cookie was present', async () => {
    const { event } = postEvent([mocks.USER_SESSION_COOKIE])

    await POST(event)

    expect(mocks.logEvent).toHaveBeenCalledWith({ ip: '127.0.0.1', action: 'user_logout' })
  })
})
