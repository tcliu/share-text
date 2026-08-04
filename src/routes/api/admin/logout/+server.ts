import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ADMIN_SESSION_COOKIE } from '$lib/server/admin-auth'
import { logEvent } from '$lib/server/logging'

export const POST: RequestHandler = async ({ cookies, getClientAddress }) => {
  cookies.delete(ADMIN_SESSION_COOKIE, { path: '/' })
  logEvent({ ip: getClientAddress(), action: 'admin_logout' })
  return json({ ok: true })
}
