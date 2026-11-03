import type { RequestHandler } from './$types'
import { listDistinctTags } from '#lib/server/document-store.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const GET: RequestHandler = async ({ getClientAddress, cookies }) => {
  const viewer = await resolveViewer({ cookies, getClientAddress })
  const tags = await listDistinctTags(viewer)
  return Response.json({ tags })
}
