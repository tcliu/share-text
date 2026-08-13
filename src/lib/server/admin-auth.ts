import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RequestEvent } from '@sveltejs/kit'
import { hashPassword, verifyPassword } from './password'
import { isLoginRateLimited, recordLoginAttempt, resetLoginAttempts } from './rate-limit'
import { sessionSecret } from './session'

export { hashPassword, verifyPassword }
export { isLoginRateLimited, recordLoginAttempt, resetLoginAttempts }

export const ADMIN_SESSION_COOKIE = 'share-text-admin-session'
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24
export const ADMIN_SESSION_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const ADMIN_SESSION_REMEMBER_MAX_AGE = 60 * 60 * 24 * 30

export function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || '').trim() || 'admin'
}

function readAdminPassword() {
  const plain = (process.env.ADMIN_PASSWORD || '').trim()
  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim()
  if (hash) {
    return { hash, configured: true }
  }
  if (plain) {
    return { hash: hashPassword(plain), configured: true }
  }
  return { hash: null, configured: false }
}

export function isAdminConfigured() {
  return readAdminPassword().configured
}

export function verifyAdminCredentials(username: string, password: string) {
  if (!isAdminConfigured()) {
    return false
  }
  const { hash } = readAdminPassword()
  if (!hash) {
    return false
  }
  return username === getAdminUsername() && verifyPassword(password, hash)
}

export function createSessionToken(ttlMs = ADMIN_SESSION_TTL_MS) {
  const payload = JSON.stringify({ exp: Date.now() + ttlMs })
  const body = Buffer.from(payload, 'utf8').toString('base64url')
  const signature = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) {
    return false
  }
  const parts = token.split('.')
  if (parts.length !== 2) {
    return false
  }
  const [body, signature] = parts
  if (!body || !signature) {
    return false
  }
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  if (signature.length !== expected.length) {
    return false
  }
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

export function isAdminSession(event: Pick<RequestEvent, 'cookies'>) {
  return verifySessionToken(event.cookies.get(ADMIN_SESSION_COOKIE))
}
