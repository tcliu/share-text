import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getCurrentUserId } from '$lib/server/user-auth'
import { listRecentSharees } from '$lib/server/users'

export const GET: RequestHandler = async ({ cookies }) => {
  const userId = getCurrentUserId({ cookies })
  if (userId === null) {
    return json({ error: 'Authentication required' }, { status: 401 })
  }
  const users = await listRecentSharees(userId)
  return json({ users })
}
