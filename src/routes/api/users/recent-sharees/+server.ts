import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listRecentSharees } from '$lib/server/users'
import { resolveViewer } from '$lib/server/viewer'

export const GET: RequestHandler = async ({ cookies, getClientAddress }) => {
  const viewer = await resolveViewer({ cookies, getClientAddress })
  if (viewer.type !== 'user') {
    return json({ error: 'Authentication required' }, { status: 401 })
  }
  const users = await listRecentSharees(viewer.userId)
  return json({ users })
}
