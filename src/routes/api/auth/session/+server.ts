import type { RequestHandler } from './$types'
import { getAdminUsername, isAdminSession } from '#lib/server/admin-auth.js'
import { USER_SESSION_COOKIE, getCurrentUserId } from '#lib/server/user-auth.js'
import { findUserById } from '#lib/server/users.js'

export const GET: RequestHandler = async ({ cookies }) => {
  const admin = isAdminSession({ cookies }) ? { username: getAdminUsername() } : null
  const userId = getCurrentUserId({ cookies })
  if (userId === null) {
    return Response.json({ user: null, admin })
  }
  const user = await findUserById(userId)
  if (!user || user.status === 'inactive') {
    cookies.delete(USER_SESSION_COOKIE, { path: '/' })
    return Response.json({ user: null, admin })
  }
  return Response.json({ user: { id: user.id, username: user.username, email: user.email }, admin })
}
