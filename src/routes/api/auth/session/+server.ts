import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { USER_SESSION_COOKIE, getCurrentUserId } from '$lib/server/user-auth'
import { findUserById } from '$lib/server/users'

export const GET: RequestHandler = async ({ cookies }) => {
  const userId = getCurrentUserId({ cookies })
  if (userId === null) {
    return json({ user: null })
  }
  const user = await findUserById(userId)
  if (!user || user.status === 'inactive') {
    cookies.delete(USER_SESSION_COOKIE, { path: '/' })
    return json({ user: null })
  }
  return json({ user: { id: user.id, username: user.username, email: user.email } })
}
