import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_SESSION_REMEMBER_MAX_AGE,
  ADMIN_SESSION_REMEMBER_TTL_MS,
  ADMIN_SESSION_TTL_MS,
  ADMIN_SESSION_MAX_AGE,
} from '$lib/server/admin-auth'
import { USER_SESSION_MAX_AGE, USER_SESSION_TTL_MS } from '$lib/server/user-auth'

const mocks = vi.hoisted(() => ({
  isLoginRateLimited: vi.fn(),
  recordLoginAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
  isAdminConfigured: vi.fn(),
  getAdminUsername: vi.fn(),
  verifyAdminCredentials: vi.fn(),
  createSessionToken: vi.fn(),
  findUserByCredentials: vi.fn(),
  claimAnonymousDocuments: vi.fn(),
  resolveProfile: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    isAdminConfigured: mocks.isAdminConfigured,
    getAdminUsername: mocks.getAdminUsername,
    verifyAdminCredentials: mocks.verifyAdminCredentials,
    createSessionToken: mocks.createSessionToken,
  }
})

vi.mock('$lib/server/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/rate-limit')>('$lib/server/rate-limit')
  return {
    ...actual,
    isLoginRateLimited: mocks.isLoginRateLimited,
    recordLoginAttempt: mocks.recordLoginAttempt,
    resetLoginAttempts: mocks.resetLoginAttempts,
  }
})

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    findUserByCredentials: mocks.findUserByCredentials,
  }
})

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    claimAnonymousDocuments: mocks.claimAnonymousDocuments,
  }
})

vi.mock('$lib/server/profile', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/profile')>('$lib/server/profile')
  return {
    ...actual,
    resolveProfile: mocks.resolveProfile,
  }
})

import { POST } from '../+server'

function createCookies() {
  const store = new Map<string, { value: string; options: Record<string, unknown> }>()
  return {
    store,
    cookies: {
      set(name: string, value: string, options: Record<string, unknown>) {
        store.set(name, { value, options })
      },
      get(name: string) {
        return store.get(name)?.value
      },
      delete(name: string, options?: Record<string, unknown>) {
        store.delete(name)
      },
    },
  }
}

function postEvent(input: { ip?: string; body: unknown }) {
  const { store, cookies } = createCookies()
  return {
    event: {
      request: new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input.body),
      }),
      getClientAddress: () => input.ip ?? '127.0.0.1',
      cookies,
    } as never,
    store,
  }
}

const alice = { id: 1, username: 'alice', email: 'alice@example.com' }

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isLoginRateLimited.mockReturnValue(false)
    mocks.isAdminConfigured.mockReturnValue(false)
    mocks.getAdminUsername.mockReturnValue('admin')
    mocks.verifyAdminCredentials.mockReturnValue(false)
    mocks.createSessionToken.mockReturnValue('signed-token')
    mocks.resolveProfile.mockReturnValue('dev')
    mocks.findUserByCredentials.mockResolvedValue(alice)
  })

  it('signs in a regular user and sets the user session cookie', async () => {
    const { event, store } = postEvent({ body: { identifier: 'alice', password: 'secret' } })

    const response = await POST(event)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user: alice })
    expect(mocks.findUserByCredentials).toHaveBeenCalledWith('alice', 'secret')
    expect(mocks.claimAnonymousDocuments).toHaveBeenCalled()
    const cookie = store.get('share-text-user-session')
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: USER_SESSION_MAX_AGE })
    expect(mocks.createSessionToken).not.toHaveBeenCalled()
  })

  it('sets a longer-lived user session when rememberMe is true', async () => {
    const { event } = postEvent({ body: { identifier: 'alice', password: 'secret', rememberMe: true } })

    await POST(event)

    expect(mocks.findUserByCredentials).toHaveBeenCalled()
  })

  it('authenticates the configured admin and sets the admin session cookie', async () => {
    mocks.isAdminConfigured.mockReturnValue(true)
    mocks.verifyAdminCredentials.mockReturnValue(true)
    const { event, store } = postEvent({ body: { identifier: 'admin', password: 'adminpass' } })

    const response = await POST(event)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ admin: true })
    expect(mocks.verifyAdminCredentials).toHaveBeenCalledWith('admin', 'adminpass')
    expect(mocks.findUserByCredentials).not.toHaveBeenCalled()
    expect(mocks.createSessionToken).toHaveBeenCalledWith(ADMIN_SESSION_TTL_MS)
    const cookie = store.get('share-text-admin-session')
    expect(cookie?.value).toBe('signed-token')
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: ADMIN_SESSION_MAX_AGE })
  })

  it('matches the admin username case-insensitively', async () => {
    mocks.isAdminConfigured.mockReturnValue(true)
    mocks.verifyAdminCredentials.mockReturnValue(true)
    const { event } = postEvent({ body: { identifier: 'Admin', password: 'adminpass' } })

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(mocks.verifyAdminCredentials).toHaveBeenCalledWith('admin', 'adminpass')
  })

  it('issues a longer-lived admin session when rememberMe is true', async () => {
    mocks.isAdminConfigured.mockReturnValue(true)
    mocks.verifyAdminCredentials.mockReturnValue(true)
    const { event, store } = postEvent({
      body: { identifier: 'admin', password: 'adminpass', rememberMe: true },
    })

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(mocks.createSessionToken).toHaveBeenCalledWith(ADMIN_SESSION_REMEMBER_TTL_MS)
    expect(store.get('share-text-admin-session')?.options).toMatchObject({
      maxAge: ADMIN_SESSION_REMEMBER_MAX_AGE,
    })
  })

  it('rejects the admin username with a wrong password without falling back to the user table', async () => {
    mocks.isAdminConfigured.mockReturnValue(true)
    mocks.findUserByCredentials.mockResolvedValue({ id: 9, username: 'admin', email: 'admin@example.com' })
    const { event } = postEvent({ body: { identifier: 'admin', password: 'wrong' } })

    const response = await POST(event)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid username/email or password' })
    expect(mocks.recordLoginAttempt).toHaveBeenCalled()
    expect(mocks.findUserByCredentials).not.toHaveBeenCalled()
    expect(mocks.resetLoginAttempts).not.toHaveBeenCalled()
  })

  it('falls through to the user table when the identifier is not the admin username', async () => {
    mocks.isAdminConfigured.mockReturnValue(true)
    const { event } = postEvent({ body: { identifier: 'alice', password: 'secret' } })

    const response = await POST(event)

    expect(response.status).toBe(200)
    expect(mocks.verifyAdminCredentials).not.toHaveBeenCalled()
    expect(mocks.findUserByCredentials).toHaveBeenCalledWith('alice', 'secret')
  })

  it('returns 401 for bad user credentials', async () => {
    mocks.findUserByCredentials.mockResolvedValue(null)
    const { event } = postEvent({ body: { identifier: 'nobody', password: 'wrong' } })

    const response = await POST(event)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid username/email or password' })
    expect(mocks.recordLoginAttempt).toHaveBeenCalled()
  })

  it('returns 429 when the IP is rate limited', async () => {
    mocks.isLoginRateLimited.mockReturnValue(true)
    const { event } = postEvent({ body: { identifier: 'alice', password: 'secret' } })

    const response = await POST(event)

    expect(response.status).toBe(429)
    expect(mocks.findUserByCredentials).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-object body', async () => {
    const { event } = postEvent({ body: [] })

    const response = await POST(event)

    expect(response.status).toBe(400)
  })
})
