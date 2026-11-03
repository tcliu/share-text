import type { RequestHandler } from './$types'
import { listRecentSharees } from '#lib/server/users.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const GET: RequestHandler = async ({ cookies, getClientAddress }) => {
  const viewer = await resolveViewer({ cookies, getClientAddress })
  if (viewer.type !== 'user') {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const users = await listRecentSharees(viewer.userId)
  return Response.json({ users })
}
