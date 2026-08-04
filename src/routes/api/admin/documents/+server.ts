import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listDocumentsForAdmin } from '$lib/server/documents'
import { parseNonNegativeInt, parsePositiveInt } from '$lib/server/parse-query'

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 200)
  const by = (url.searchParams.get('by') ?? '').trim().slice(0, 100)

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)

  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const { documents, total, hasMore } = await listDocumentsForAdmin({
    search,
    by,
    limit: limit !== null ? limit : undefined,
    offset,
  })

  return json({
    documents,
    total,
    hasMore,
  })
}
