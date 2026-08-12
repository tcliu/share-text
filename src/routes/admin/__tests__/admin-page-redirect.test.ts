import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    isAdminSession: authMocks.isAdminSession,
  }
})

import { load } from '../+page.server'

describe('admin root page', () => {
  beforeEach(() => {
    authMocks.isAdminSession.mockReset()
  })

  it('redirects to /admin/properties only when the session is authenticated', async () => {
    authMocks.isAdminSession.mockReturnValue(true)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /admin/properties')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/admin/properties')
    }
  })

  it('redirects to /login when the session is not authenticated', async () => {
    authMocks.isAdminSession.mockReturnValue(false)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /login')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/login')
    }
  })
})
