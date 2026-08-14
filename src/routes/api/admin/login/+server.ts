import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  ADMIN_SESSION_REMEMBER_MAX_AGE,
  ADMIN_SESSION_REMEMBER_TTL_MS,
  ADMIN_SESSION_TTL_MS,
  createSessionToken,
  isLoginRateLimited,
  recordLoginAttempt,
  resetLoginAttempts,
  verifyAdminCredentials,
} from '$lib/server/admin-auth'
import { logEvent } from '$lib/server/logging'
import { resolveProfile } from '$lib/server/profile'
import { isBodyRecord } from '$lib/server/request-utils'

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
  const ip = getClientAddress()

  if (await isLoginRateLimited(ip)) {
    logEvent({ ip, action: 'admin_login_rate_limited', details: { level: 'WARN' } })
    return json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const rememberMe = body.rememberMe === true

  if (!(await verifyAdminCredentials(username, password))) {
    await recordLoginAttempt(ip)
    logEvent({ ip, action: 'admin_login_failed', details: { username } })
    return json({ error: 'Invalid username or password' }, { status: 401 })
  }

  await resetLoginAttempts(ip)
  const ttlMs = rememberMe ? ADMIN_SESSION_REMEMBER_TTL_MS : ADMIN_SESSION_TTL_MS
  cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(ttlMs), {
    httpOnly: true,
    sameSite: 'strict',
    secure: resolveProfile() === 'prod',
    path: '/',
    maxAge: rememberMe ? ADMIN_SESSION_REMEMBER_MAX_AGE : ADMIN_SESSION_MAX_AGE,
  })
  logEvent({ ip, action: 'admin_login', details: { username, remember_me: rememberMe } })
  return json({ ok: true })
}
