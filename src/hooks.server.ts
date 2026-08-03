import type { Handle } from '@sveltejs/kit'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '$lib/server/admin-auth'

const PUBLIC_ADMIN_PATHS = new Set(['/api/admin/login', '/api/admin/session'])

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url

  if ((pathname === '/api/admin' || pathname.startsWith('/api/admin/')) && !PUBLIC_ADMIN_PATHS.has(pathname)) {
    if (!verifySessionToken(event.cookies.get(ADMIN_SESSION_COOKIE))) {
      return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  return resolve(event)
}
