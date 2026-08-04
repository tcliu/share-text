import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  contentByteSize,
  DocumentLimitError,
  fetchDocumentSummaries,
  insertDocument,
  normalizeName,
} from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { parseNonNegativeInt, parsePositiveInt } from '$lib/server/parse-query'
import { isBodyRecord } from '$lib/server/request-utils'
import { getMaxContentLength } from '$lib/server/settings'

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)

  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const { documents, hasMore } = await fetchDocumentSummaries({
    by: getClientAddress(),
    limit: limit !== null ? limit : undefined,
    offset,
  })

  return json({ documents, hasMore })
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
  const ip = getClientAddress()

  let name: string | undefined
  try {
    if (rawName) {
      name = normalizeName(rawName)
    }
    assertContentWithinLimit(rawContent, await getMaxContentLength())
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid document' }, { status: 400 })
  }

  const startedAt = Date.now()
  try {
    const document = await insertDocument({ name, content: rawContent, by: ip })
    logEvent({
      ip,
      action: 'document_create',
      details: {
        id: document.id,
        name: document.name,
        content_size: contentByteSize(rawContent),
        elapsed_ms: Date.now() - startedAt,
      },
    })
    return json({ document }, { status: 201 })
  } catch (error) {
    if (error instanceof DocumentLimitError) {
      logEvent({
        ip,
        action: 'document_limit',
        details: { name: name ?? null, level: 'WARN' },
      })
      return json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}
