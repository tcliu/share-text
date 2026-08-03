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

function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePositiveInt(value: string | null) {
  if (value === null) {
    return null
  }

  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseNonNegativeInt(value: string | null) {
  if (value === null) {
    return 0
  }

  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)

  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const documents = await fetchDocumentSummaries(limit !== null ? limit : undefined, offset)

  return json({ documents, hasMore: limit !== undefined && documents.length === limit })
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (Object.keys(body).some(key => key !== 'name' && key !== 'content')) {
    return json({ error: 'Unsupported fields in request body' }, { status: 400 })
  }

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
