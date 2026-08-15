import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  contentByteSize,
  importDocumentsForAdmin,
  listDocumentsForAdmin,
  MAX_IMPORT_RECORDS,
  normalizeImportTags,
  type ImportDocumentRecord,
} from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { parseNonNegativeInt, parsePositiveInt, parseSearchParams } from '$lib/server/parse-query'
import { isBodyRecord } from '$lib/server/request-utils'

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

const IMPORT_FIELDS = new Set(['name', 'content', 'documentType', 'tags', 'isPublic', 'key'])

const CREATE_FIELDS = new Set(['name', 'content', 'documentType'])

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }

  const ip = getClientAddress()

  if ('records' in body) {
    return handleImportDocuments(body, ip)
  }
  return handleCreateDocument(body, ip)
}

async function handleImportDocuments(body: Record<string, unknown>, ip: string) {
  if (!Array.isArray(body.records)) {
    return json({ error: 'Request body must include a records array' }, { status: 400 })
  }
  if (body.records.length === 0) {
    return json({ error: 'No records to import' }, { status: 400 })
  }
  if (body.records.length > MAX_IMPORT_RECORDS) {
    return json({ error: `Cannot import more than ${MAX_IMPORT_RECORDS} records at once` }, { status: 400 })
  }

  const records: ImportDocumentRecord[] = []
  for (let i = 0; i < body.records.length; i++) {
    const record = body.records[i]
    if (!isBodyRecord(record)) {
      return json({ error: `Record ${i + 1} must be a JSON object` }, { status: 400 })
    }
    const unsupported = Object.keys(record).filter(key => !IMPORT_FIELDS.has(key))
    if (unsupported.length > 0) {
      return json({ error: `Record ${i + 1} contains unsupported fields: ${unsupported.join(', ')}` }, { status: 400 })
    }
    records.push({
      name: typeof record.name === 'string' ? record.name : '',
      content: typeof record.content === 'string' ? record.content : undefined,
      documentType: typeof record.documentType === 'string' ? record.documentType : undefined,
      tags: normalizeImportTags(record.tags),
      isPublic: typeof record.isPublic === 'boolean' ? record.isPublic : undefined,
      key: typeof record.key === 'string' ? record.key : undefined,
    })
  }

  const startedAt = Date.now()
  try {
    const documents = await importDocumentsForAdmin(records, ip)
    logEvent({
      ip,
      action: 'admin_document_import',
      details: {
        count: documents.length,
        content_size: documents.reduce((sum, document) => sum + contentByteSize(document.content), 0),
        elapsed_ms: Date.now() - startedAt,
      },
    })
    return json({ documents, count: documents.length }, { status: 201 })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to import documents' }, { status: 400 })
  }
}

async function handleCreateDocument(body: Record<string, unknown>, ip: string) {
  const unsupported = Object.keys(body).filter(key => !CREATE_FIELDS.has(key))
  if (unsupported.length > 0) {
    return json({ error: `Unsupported fields: ${unsupported.join(', ')}` }, { status: 400 })
  }

  const record: ImportDocumentRecord = {
    name: typeof body.name === 'string' ? body.name : '',
    content: typeof body.content === 'string' ? body.content : undefined,
    documentType: typeof body.documentType === 'string' ? body.documentType : undefined,
  }

  const startedAt = Date.now()
  try {
    const [document] = await importDocumentsForAdmin([record], ip)
    logEvent({
      ip,
      action: 'admin_document_create',
      details: {
        id: document.id,
        name: document.name,
        content_size: contentByteSize(document.content),
        elapsed_ms: Date.now() - startedAt,
      },
    })
    return json({ document }, { status: 201 })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to create document' }, { status: 400 })
  }
}
