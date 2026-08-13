import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { claimAnonymousDocuments } from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { isBodyRecord } from '$lib/server/request-utils'
import { resolveProfile } from '$lib/server/profile'
import { isLoginRateLimited, recordLoginAttempt, resetLoginAttempts } from '$lib/server/rate-limit'
import {
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE,
  USER_SESSION_REMEMBER_MAX_AGE,
  USER_SESSION_REMEMBER_TTL_MS,
  USER_SESSION_TTL_MS,
  createUserSessionToken,
} from '$lib/server/user-auth'
import { findUserByCredentials } from '$lib/server/users'

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
  const ip = getClientAddress()

  if (isLoginRateLimited(ip)) {
    logEvent({ ip, action: 'user_login_rate_limited', details: { level: 'WARN' } })
    return json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const identifier = typeof body.identifier === 'string' ? body.identifier : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const rememberMe = body.rememberMe === true

  const user = await findUserByCredentials(identifier, password)
  if (!user) {
    recordLoginAttempt(ip)
    logEvent({ ip, action: 'user_login_failed', details: { identifier } })
    return json({ error: 'Invalid username/email or password' }, { status: 401 })
  }

  resetLoginAttempts(ip)
  await claimAnonymousDocuments(ip, user)
  const ttlMs = rememberMe ? USER_SESSION_REMEMBER_TTL_MS : USER_SESSION_TTL_MS
  cookies.set(USER_SESSION_COOKIE, createUserSessionToken(user.id, ttlMs), {
    httpOnly: true,
    sameSite: 'strict',
    secure: resolveProfile() === 'prod',
    path: '/',
    maxAge: rememberMe ? USER_SESSION_REMEMBER_MAX_AGE : USER_SESSION_MAX_AGE,
  })
  logEvent({ ip, action: 'user_login', details: { username: user.username, remember_me: rememberMe } })
  return json({ user })
}
