import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listDistinctTags } from '$lib/server/documents'
import { resolveViewer } from '$lib/server/viewer'

export const GET: RequestHandler = async ({ getClientAddress, cookies }) => {
  const viewer = await resolveViewer({ cookies, getClientAddress })
  const tags = await listDistinctTags(viewer)
  return json({ tags })
}
