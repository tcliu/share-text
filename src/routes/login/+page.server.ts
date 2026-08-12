import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isAdminConfigured, isAdminSession } from '$lib/server/admin-auth'

export const load: PageServerLoad = ({ cookies }) => {
  if (isAdminSession({ cookies })) {
    throw redirect(307, '/admin/properties')
  }
  return { configured: isAdminConfigured() }
}
