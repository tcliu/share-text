import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  contentByteSize,
  deleteDocument,
  normalizeName,
  resolveDocumentAccess,
  updateDocument,
} from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { parseDocumentId } from '$lib/server/request-utils'
import { resolveViewer } from '$lib/server/viewer'

export const PUT: RequestHandler = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return json({ error: 'Authentication required' }, { status: 401 })
  }

  const id = await parseDocumentId(event.params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await event.request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name : undefined
  if (name === undefined) {
    return json({ error: 'Request body must include name' }, { status: 400 })
  }

  try {
    normalizeName(name)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
  }

  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canDelete) {
    return json({ error: 'You do not have permission to manage this document' }, { status: 403 })
  }

  const startedAt = Date.now()
  const document = await updateDocument(id, { name, by: viewer.name })
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip: viewer.ip,
    action: 'document_save',
    details: {
      id,
      name: document.name,
      elapsed_ms: Date.now() - startedAt,
      content_size: contentByteSize(document.content),
    },
  })

  return json({ document })
}

export const DELETE: RequestHandler = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return json({ error: 'Authentication required' }, { status: 401 })
  }

  const id = await parseDocumentId(event.params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canDelete) {
    return json({ error: 'You do not have permission to manage this document' }, { status: 403 })
  }

  const startedAt = Date.now()
  const deleted = await deleteDocument(id)
  if (!deleted) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip: viewer.ip,
    action: 'document_delete',
    details: { id, name: access.document.name, elapsed_ms: Date.now() - startedAt },
  })

  return new Response(null, { status: 204 })
}
