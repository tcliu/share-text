import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  DocumentLimitError,
  fetchDocumentSummaries,
  insertDocument,
  nextDefaultDocumentName,
  normalizeName,
} from '$lib/server/documents'

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')

  const limit = limitParam ? parseInt(limitParam, 10) : undefined
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0

  const documents = await fetchDocumentSummaries(limit, offset)

  return json({ documents, hasMore: limit !== undefined && documents.length === limit })
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  const rawName = typeof body.name === 'string' && body.name.trim() !== '' ? body.name : null
  const rawContent = typeof body.content === 'string' ? body.content : ''

  let name: string
  try {
    if (rawName) {
      name = normalizeName(rawName)
    } else {
      const summaries = await fetchDocumentSummaries()
      name = nextDefaultDocumentName(summaries.map(summary => summary.name))
    }
    assertContentWithinLimit(rawContent)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid document' }, { status: 400 })
  }

  try {
    const document = await insertDocument({ name, content: rawContent, by: getClientAddress() })
    return json({ document }, { status: 201 })
  } catch (error) {
    if (error instanceof DocumentLimitError) {
      return json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
