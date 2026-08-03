import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  contentByteSize,
  deleteDocument,
  fetchDocument,
  isDocumentKey,
  normalizeName,
  updateDocument,
} from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'

function parseDocumentId(value: string | undefined) {
  if (!value || !isDocumentKey(value)) {
    return null
  }
  return value
}

function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const GET: RequestHandler = async ({ params }) => {
  const id = parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const document = await fetchDocument(id)
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  return json({ document })
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
  const id = parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const bodyKeys = Object.keys(body)
  if (bodyKeys.some(key => key !== 'name' && key !== 'content')) {
    return json({ error: 'Unsupported fields in request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name : undefined
  const content = typeof body.content === 'string' ? body.content : undefined

  if (name === undefined && content === undefined) {
    return json({ error: 'Request body must include name or content' }, { status: 400 })
  }

  if (name !== undefined) {
    try {
      normalizeName(name)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
    }
  }

  if (content !== undefined) {
    try {
      assertContentWithinLimit(content)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid content' }, { status: 400 })
    }
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const document = await updateDocument(id, { name, content, by: ip })
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const details: Record<string, unknown> = { id, name: document.name, elapsed_ms: Date.now() - startedAt }
  if (content !== undefined) {
    details.content_size = contentByteSize(content)
  }
  logEvent({ ip, action: 'document_save', details })

  return json({ document })
}

export const DELETE: RequestHandler = async ({ params, getClientAddress }) => {
  const id = parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const document = await fetchDocument(id)
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const deleted = await deleteDocument(id)
  if (!deleted) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip,
    action: 'document_delete',
    details: { id, name: document.name, elapsed_ms: Date.now() - startedAt },
  })

  return new Response(null, { status: 204 })
}
