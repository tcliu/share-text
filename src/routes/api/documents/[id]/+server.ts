import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  deleteDocument,
  fetchDocument,
  isDocumentKey,
  normalizeName,
  updateDocument,
} from '$lib/server/documents'

function parseDocumentId(value: string | undefined) {
  if (!value || !isDocumentKey(value)) {
    return null
  }
  return value
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
  const name = typeof body.name === 'string' ? body.name : undefined
  const content = typeof body.content === 'string' ? body.content : undefined

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

  const document = await updateDocument(id, { name, content, by: getClientAddress() })
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  return json({ document })
}

export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const deleted = await deleteDocument(id)
  if (!deleted) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  return new Response(null, { status: 204 })
}
