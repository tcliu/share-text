import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getCurrentUserId } from '$lib/server/user-auth'
import { findUserById } from '$lib/server/users'

export const GET: RequestHandler = async ({ cookies }) => {
  const userId = getCurrentUserId({ cookies })
  if (userId === null) {
    return json({ user: null })
  }
  const user = await findUserById(userId)
  return json({ user: user ? { id: user.id, username: user.username, email: user.email } : null })
}
