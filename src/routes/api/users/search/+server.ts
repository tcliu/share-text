import type { RequestHandler } from './$types'
import { isAdminSession } from '#lib/server/admin-auth.js'
import { searchUsers } from '#lib/server/users.js'

export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!isAdminSession({ cookies })) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  if (!query) {
    return Response.json({ users: [] })
  }
  const users = await searchUsers(query, 10, true)
  return Response.json({ users })
}
