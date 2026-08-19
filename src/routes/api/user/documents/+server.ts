import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { DOCUMENT_SEARCH_KEYS, listDocumentsForOwnedUser } from '$lib/server/documents'
import { parseNonNegativeInt, parsePositiveInt, parseSearchParams } from '$lib/server/parse-query'
import { resolveViewer } from '$lib/server/viewer'

export const GET: RequestHandler = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return json({ error: 'Authentication required' }, { status: 401 })
  }

  const limitParam = event.url.searchParams.get('limit')
  const offsetParam = event.url.searchParams.get('offset')
  const { search, searchKeys } = parseSearchParams(event.url)
  const sortBy = (event.url.searchParams.get('sortBy') ?? '').trim().slice(0, 50)
  const orderParam = event.url.searchParams.get('order')

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)
  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const invalidSearchKeys = searchKeys.filter(key => !DOCUMENT_SEARCH_KEYS.includes(key))
  if (invalidSearchKeys.length > 0) {
    return json({ error: 'Invalid search-keys' }, { status: 400 })
  }

  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : undefined
  const result = await listDocumentsForOwnedUser(viewer.userId, {
    search,
    searchKeys,
    limit: limit ?? undefined,
    offset,
    sortBy: sortBy || undefined,
    order,
  })
  return json(result)
}
