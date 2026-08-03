import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  contentByteSize,
  deleteDocument,
  fetchDocument,
  fetchDocumentForAdmin,
  isDocumentKey,
  normalizeName,
  updateDocument,
} from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { getDocumentKeyLength } from '$lib/server/settings'

async function parseDocumentId(value: string | undefined) {
  if (!value || !isDocumentKey(value, await getDocumentKeyLength())) {
    return null
  }
  return value
}

function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const GET: RequestHandler = async ({ params }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const document = await fetchDocumentForAdmin(id)
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  return json({ document })
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body) || typeof body.name !== 'string') {
    return json({ error: 'Request body must include a name' }, { status: 400 })
  }

  let name: string
  try {
    name = normalizeName(body.name)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
  }

  const existing = await fetchDocumentForAdmin(id)
  if (!existing) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const ip = getClientAddress()
  const updated = await updateDocument(id, { name, by: ip })
  if (!updated) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip,
    action: 'admin_document_rename',
    details: { id, old_name: existing.name, new_name: name },
  })

  const document = {
    id: updated.id,
    name: updated.name,
    createdBy: existing.createdBy,
    updatedBy: updated.updatedBy,
    createdAt: existing.createdAt,
    updatedAt: updated.updatedAt,
    contentSize: contentByteSize(updated.content),
    content: updated.content,
  }
  return json({ document })
}

export const DELETE: RequestHandler = async ({ params, getClientAddress }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const existing = await fetchDocument(id)
  if (!existing) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const ip = getClientAddress()
  const deleted = await deleteDocument(id)
  if (!deleted) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip,
    action: 'admin_document_delete',
    details: { id, name: existing.name, content_size: contentByteSize(existing.content) },
  })

  return new Response(null, { status: 204 })
}
