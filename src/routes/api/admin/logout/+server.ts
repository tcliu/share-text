import type { RequestHandler } from './$types'
import { ADMIN_SESSION_COOKIE } from '#lib/server/admin-auth.js'
import { logEvent } from '#lib/server/logging.js'
import { resolveProfile } from '#lib/server/profile.js'

export const POST: RequestHandler = async ({ cookies, getClientAddress }) => {
  let ip = 'unknown'
  try {
    ip = getClientAddress()
  } catch {
    ip = 'unknown'
  }
  cookies.delete(ADMIN_SESSION_COOKIE, {
    path: '/',
    sameSite: 'strict',
    secure: resolveProfile() === 'prod',
  })
  logEvent({ ip, action: 'admin_logout' })
  return Response.json({ ok: true })
}
