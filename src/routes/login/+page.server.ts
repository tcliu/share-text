import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isAdminSession } from '$lib/server/admin-auth'
import { isUserSession } from '$lib/server/user-auth'

export const load: PageServerLoad = ({ cookies }) => {
  if (isAdminSession({ cookies })) {
    throw redirect(307, '/admin/general')
  }
  if (isUserSession({ cookies })) {
    throw redirect(307, '/')
  }
  // No standalone form remains: unauthenticated visitors land on the browser
  // page with the login dialog auto-opened.
  throw redirect(307, '/?login=1')
}
