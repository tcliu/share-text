import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { isAdminSession } from '$lib/server/admin-auth'
import { searchUsers } from '$lib/server/users'

export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!isAdminSession({ cookies })) {
    return json({ error: 'Authentication required' }, { status: 401 })
  }
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  if (!query) {
    return json({ users: [] })
  }
  const users = await searchUsers(query, 10, true)
  return json({ users })
}
