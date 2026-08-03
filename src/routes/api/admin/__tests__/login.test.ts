import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  isLoginRateLimited: vi.fn(),
  recordLoginAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
  verifyAdminCredentials: vi.fn(),
  createSessionToken: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    isLoginRateLimited: authMocks.isLoginRateLimited,
    recordLoginAttempt: authMocks.recordLoginAttempt,
    resetLoginAttempts: authMocks.resetLoginAttempts,
    verifyAdminCredentials: authMocks.verifyAdminCredentials,
    createSessionToken: authMocks.createSessionToken,
  }
})

import { POST } from '../login/+server'

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
      request: new Request('http://localhost/api/admin/login', {
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

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.isLoginRateLimited.mockReturnValue(false)
    authMocks.verifyAdminCredentials.mockReturnValue(false)
    authMocks.createSessionToken.mockReturnValue('signed-token')
  })

  it('sets an httpOnly session cookie on success', async () => {
    authMocks.verifyAdminCredentials.mockReturnValue(true)
    const { event, store } = postEvent({ body: { username: 'admin', password: 'pass' } })

    const response = await POST(event)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(authMocks.resetLoginAttempts).toHaveBeenCalledWith('127.0.0.1')
    const cookie = store.get('share-text-admin-session')
    expect(cookie?.value).toBe('signed-token')
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/' })
  })

  it('returns 401 and records the attempt on bad credentials', async () => {
    const { event } = postEvent({ body: { username: 'admin', password: 'wrong' } })

    const response = await POST(event)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid username or password' })
    expect(authMocks.recordLoginAttempt).toHaveBeenCalledWith('127.0.0.1')
  })

  it('returns 429 when the IP is rate limited', async () => {
    authMocks.isLoginRateLimited.mockReturnValue(true)
    const { event } = postEvent({ body: { username: 'admin', password: 'pass' } })

    const response = await POST(event)

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'Too many login attempts. Try again later.' })
    expect(authMocks.verifyAdminCredentials).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-object body', async () => {
    const { event } = postEvent({ body: [] })

    const response = await POST(event)

    expect(response.status).toBe(400)
  })
})
