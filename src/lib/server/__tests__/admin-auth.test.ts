import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSessionToken,
  getAdminUsername,
  hashPassword,
  isAdminConfigured,
  isLoginRateLimited,
  recordLoginAttempt,
  resetLoginAttempts,
  verifyAdminCredentials,
  verifyPassword,
  verifySessionToken,
} from '$lib/server/admin-auth'

afterEach(() => {
  delete process.env.ADMIN_USERNAME
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_PASSWORD_HASH
  delete process.env.SESSION_SECRET
})

describe('password hashing', () => {
  it('verifies a hashed password', () => {
    const hash = hashPassword('s3cret')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('s3cret', hash)).toBe(true)
    expect(verifyPassword('wrong', hash)).toBe(false)
  })

  it('rejects malformed hashes', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(verifyPassword('x', 'md5$abc$def')).toBe(false)
  })
})

describe('admin credentials', () => {
  it('verifies username and password from env', () => {
    process.env.ADMIN_USERNAME = 'root'
    process.env.ADMIN_PASSWORD = 'hunter2'
    expect(getAdminUsername()).toBe('root')
    expect(verifyAdminCredentials('root', 'hunter2')).toBe(true)
    expect(verifyAdminCredentials('root', 'wrong')).toBe(false)
    expect(verifyAdminCredentials('other', 'hunter2')).toBe(false)
  })

  it('prefers an explicit password hash over the plain password', () => {
    const hash = hashPassword('hashed-pass')
    process.env.ADMIN_PASSWORD_HASH = hash
    process.env.ADMIN_PASSWORD = 'plain-pass'
    expect(verifyAdminCredentials('admin', 'hashed-pass')).toBe(true)
    expect(verifyAdminCredentials('admin', 'plain-pass')).toBe(false)
  })

  it('reports that admin is not configured without any password source', () => {
    expect(isAdminConfigured()).toBe(false)
    expect(verifyAdminCredentials('admin', 'anything')).toBe(false)
  })
})

describe('session tokens', () => {
  it('round-trips a freshly created token', () => {
    const token = createSessionToken()
    expect(verifySessionToken(token)).toBe(true)
  })

  it('rejects missing, malformed, and tampered tokens', () => {
    expect(verifySessionToken(undefined)).toBe(false)
    expect(verifySessionToken(null)).toBe(false)
    expect(verifySessionToken('')).toBe(false)
    expect(verifySessionToken('only-body')).toBe(false)
    expect(verifySessionToken('a.b.c')).toBe(false)

    const token = createSessionToken()
    const [body, signature] = token.split('.')
    expect(verifySessionToken(`${body}.${signature}extra`)).toBe(false)
    expect(verifySessionToken(`${body}x.${signature}`)).toBe(false)
  })

  it('rejects an expired token', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'))
    const token = createSessionToken()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    expect(verifySessionToken(token)).toBe(false)
    vi.useRealTimers()
  })
})

describe('login rate limiting', () => {
  it('allows attempts up to the threshold then blocks', () => {
    resetLoginAttempts('10.0.0.1')
    expect(isLoginRateLimited('10.0.0.1')).toBe(false)
    for (let i = 0; i < 5; i++) {
      recordLoginAttempt('10.0.0.1')
    }
    expect(isLoginRateLimited('10.0.0.1')).toBe(true)
  })

  it('tracks each IP independently', () => {
    resetLoginAttempts('10.0.0.1')
    resetLoginAttempts('10.0.0.2')
    for (let i = 0; i < 5; i++) {
      recordLoginAttempt('10.0.0.1')
    }
    expect(isLoginRateLimited('10.0.0.1')).toBe(true)
    expect(isLoginRateLimited('10.0.0.2')).toBe(false)
  })
})
