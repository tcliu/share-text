// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createUserSessionToken, verifyUserSessionToken } from '$lib/server/user-auth'

describe('user session token', () => {
  it('round-trips the user id', () => {
    const token = createUserSessionToken(42)
    expect(verifyUserSessionToken(token)).toBe(42)
  })

  it('rejects missing and malformed tokens', () => {
    expect(verifyUserSessionToken(null)).toBeNull()
    expect(verifyUserSessionToken(undefined)).toBeNull()
    expect(verifyUserSessionToken('')).toBeNull()
    expect(verifyUserSessionToken('only-body')).toBeNull()
    expect(verifyUserSessionToken('a.b.c')).toBeNull()
    expect(verifyUserSessionToken('not-base64.alsonot')).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = createUserSessionToken(7)
    const [body, signature] = token.split('.')
    expect(verifyUserSessionToken(`${body}.${signature}x`)).toBeNull()
    expect(verifyUserSessionToken(`${body.slice(0, -1)}a.${signature}`)).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = createUserSessionToken(7, -1000)
    expect(verifyUserSessionToken(token)).toBeNull()
  })
})
