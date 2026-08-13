import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import { USER_SESSION_COOKIE } from '$lib/server/user-auth'

export const POST: RequestHandler = async ({ cookies, getClientAddress }) => {
  cookies.delete(USER_SESSION_COOKIE, { path: '/' })
  logEvent({ ip: getClientAddress(), action: 'user_logout' })
  return json({ ok: true })
}
