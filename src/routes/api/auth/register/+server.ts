import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { claimAnonymousDocuments } from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { isBodyRecord } from '$lib/server/request-utils'
import { resolveProfile } from '$lib/server/profile'
import { isLoginRateLimited, recordLoginAttempt, resetLoginAttempts } from '$lib/server/rate-limit'
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, createUserSessionToken } from '$lib/server/user-auth'
import { createUser } from '$lib/server/users'

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
  const ip = getClientAddress()

  if (isLoginRateLimited(ip)) {
    logEvent({ ip, action: 'user_register_rate_limited', details: { level: 'WARN' } })
    return json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  let user
  try {
    user = await createUser({ username, email, password })
  } catch (error) {
    recordLoginAttempt(ip)
    const message = error instanceof Error ? error.message : 'Failed to create account'
    logEvent({ ip, action: 'user_register_failed', details: { username: username.trim(), error: message } })
    return json({ error: message }, { status: 400 })
  }

  resetLoginAttempts(ip)
  await claimAnonymousDocuments(ip, user)
  cookies.set(USER_SESSION_COOKIE, createUserSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'strict',
    secure: resolveProfile() === 'prod',
    path: '/',
    maxAge: USER_SESSION_MAX_AGE,
  })
  logEvent({ ip, action: 'user_register', details: { username: user.username } })
  return json({ user }, { status: 201 })
}
