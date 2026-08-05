import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listDistinctTags } from '$lib/server/documents'

export const GET: RequestHandler = async () => {
  const tags = await listDistinctTags()
  return json({ tags })
}
