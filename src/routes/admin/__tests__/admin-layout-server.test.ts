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

import { load } from '../+layout.server'

describe('admin layout server load', () => {
  beforeEach(() => {
    authMocks.isAdminSession.mockReset()
  })

  it('lets authenticated sessions reach the tab routes', async () => {
    authMocks.isAdminSession.mockReturnValue(true)
    const result = await load({ cookies: { get: () => null } } as never)
    expect(result).toBeUndefined()
  })

  it('redirects unauthenticated sessions to /login/admin', async () => {
    authMocks.isAdminSession.mockReturnValue(false)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /login/admin')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/login/admin')
    }
  })
})
