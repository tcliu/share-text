import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    verifySessionToken: authMocks.verifySessionToken,
  }
})

import { handle } from './hooks.server'
import { ADMIN_SESSION_COOKIE } from '$lib/server/admin-auth'

function makeEvent(pathname: string, token: string | undefined) {
  const resolve = vi.fn().mockResolvedValue(new Response('ok'))
  return {
    event: {
      url: new URL(`http://localhost${pathname}`),
      request: new Request(`http://localhost${pathname}`),
      cookies: {
        get(name: string) {
          return name === ADMIN_SESSION_COOKIE ? token : undefined
        },
      },
      resolve,
    } as never,
    resolve,
  }
}

describe('handle guard for /api/admin/*', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.verifySessionToken.mockReturnValue(true)
  })

  it('blocks unauthenticated admin requests with 401', async () => {
    authMocks.verifySessionToken.mockReturnValue(false)
    const { event, resolve } = makeEvent('/api/admin/settings', 'token')

    const response = await handle({ event, resolve } as never)

    expect(response.status).toBe(401)
    expect(resolve).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Admin authentication required' })
  })

  it('lets authenticated admin requests through', async () => {
    const { event, resolve } = makeEvent('/api/admin/settings', 'valid-token')

    const response = await handle({ event, resolve } as never)

    expect(resolve).toHaveBeenCalledWith(event)
    expect(response.status).toBe(200)
  })

  it('skips the guard for the public admin login and session endpoints', async () => {
    authMocks.verifySessionToken.mockReturnValue(false)
    for (const pathname of ['/api/admin/login', '/api/admin/session']) {
      const { event, resolve } = makeEvent(pathname, undefined)
      const response = await handle({ event, resolve } as never)
      expect(response.status).toBe(200)
      expect(resolve).toHaveBeenCalled()
    }
  })

  it('leaves non-admin routes untouched', async () => {
    authMocks.verifySessionToken.mockReturnValue(false)
    const { event, resolve } = makeEvent('/api/documents', undefined)
    const response = await handle({ event, resolve } as never)
    expect(response.status).toBe(200)
    expect(resolve).toHaveBeenCalled()
  })
})
