import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isAdminConfigured, isAdminSession } from '$lib/server/admin-auth'

export const load: PageServerLoad = async ({ cookies }) => {
  if (isAdminSession({ cookies })) {
    throw redirect(307, '/admin/properties')
  }
  return { configured: await isAdminConfigured() }
}
