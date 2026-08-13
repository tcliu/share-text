import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isUserSession } from '$lib/server/user-auth'

export const load: PageServerLoad = ({ cookies }) => {
  if (isUserSession({ cookies })) {
    throw redirect(307, '/')
  }
}
