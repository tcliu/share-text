import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listDocumentsForAdmin } from '$lib/server/documents'
import { parseNonNegativeInt, parsePositiveInt, parseSearchParams } from '$lib/server/parse-query'

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')
  const { search, searchKeys } = parseSearchParams(url)
  const by = (url.searchParams.get('by') ?? '').trim().slice(0, 100)
  const sortBy = (url.searchParams.get('sortBy') ?? '').trim().slice(0, 50)
  const orderParam = url.searchParams.get('order')

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)

  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : undefined

  const { documents, total, hasMore } = await listDocumentsForAdmin({
    search,
    searchKeys,
    by,
    limit: limit !== null ? limit : undefined,
    offset,
    sortBy: sortBy || undefined,
    order,
  })

  return json({
    documents,
    total,
    hasMore,
  })
}
