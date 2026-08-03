import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { RequestEvent } from '@sveltejs/kit'
import { resolveProfile } from './profile'

export const ADMIN_SESSION_COOKIE = 'share-text-admin-session'
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

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

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 32)
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

export function verifyPassword(password: string, hash: string) {
  const parts = hash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }
  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  const actual = scryptSync(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

function sessionSecret() {
  const explicit = (process.env.SESSION_SECRET || '').trim()
  if (explicit) {
    return explicit
  }
  if (resolveProfile() === 'prod') {
    throw new Error('SESSION_SECRET must be set in production')
  }
  return 'dev-session-secret'
}

export function createSessionToken() {
  const payload = JSON.stringify({ exp: Date.now() + ADMIN_SESSION_TTL_MS })
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

interface RateLimitEntry {
  count: number
  resetAt: number
}

const loginAttempts = new Map<string, RateLimitEntry>()
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function pruneExpiredAttempts() {
  const now = Date.now()
  for (const [ip, entry] of loginAttempts) {
    if (now >= entry.resetAt) {
      loginAttempts.delete(ip)
    }
  }
}

const cleanupTimer = setInterval(pruneExpiredAttempts, RATE_LIMIT_CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()

export function isLoginRateLimited(ip: string) {
  const entry = loginAttempts.get(ip)
  if (!entry) {
    return false
  }
  if (Date.now() >= entry.resetAt) {
    loginAttempts.delete(ip)
    return false
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS
}

export function recordLoginAttempt(ip: string) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return
  }
  entry.count += 1
}

export function resetLoginAttempts(ip: string) {
  loginAttempts.delete(ip)
}
