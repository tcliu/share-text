// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  isUserSession: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = (await vi.importActual('$lib/server/admin-auth')) as Record<string, unknown>
  return { ...actual, isAdminSession: authMocks.isAdminSession }
})

vi.mock('$lib/server/user-auth', async () => {
  const actual = (await vi.importActual('$lib/server/user-auth')) as Record<string, unknown>
  return { ...actual, isUserSession: authMocks.isUserSession }
})

import { load } from '../+page.server'

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.isAdminSession.mockReset()
  authMocks.isUserSession.mockReset()
})

describe('/login server load', () => {
  it('redirects to /admin/general for an admin session', async () => {
    authMocks.isAdminSession.mockReturnValue(true)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /admin/general')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/admin/general')
    }
  })

  it('redirects to / when already authenticated as a user', async () => {
    authMocks.isAdminSession.mockReturnValue(false)
    authMocks.isUserSession.mockReturnValue(true)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/')
    }
  })

  it('redirects unauthenticated visitors to the landing page with the login dialog', async () => {
    authMocks.isAdminSession.mockReturnValue(false)
    authMocks.isUserSession.mockReturnValue(false)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /?login=1')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/?login=1')
    }
  })
})
