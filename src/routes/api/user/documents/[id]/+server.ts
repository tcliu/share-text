import type { RequestHandler } from './$types'
import { contentByteSize, normalizeName } from '#lib/server/document-model.js'
import { deleteDocument, updateDocument } from '#lib/server/document-store.js'
import { resolveDocumentAccess } from '#lib/server/document-access.js'
import { logEvent } from '#lib/server/logging.js'
import { parseDocumentKey } from '#lib/server/request-utils.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const PUT: RequestHandler = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const id = await parseDocumentKey(event.params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await event.request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name : undefined
  if (name === undefined) {
    return Response.json({ error: 'Request body must include name' }, { status: 400 })
  }

  try {
    normalizeName(name)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
  }

  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canDelete) {
    return Response.json({ error: 'You do not have permission to manage this document' }, { status: 403 })
  }

  const startedAt = Date.now()
  const document = await updateDocument(id, { name, by: viewer.name })
  if (!document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
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

  return Response.json({ document })
}

export const DELETE: RequestHandler = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const id = await parseDocumentKey(event.params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canDelete) {
    return Response.json({ error: 'You do not have permission to manage this document' }, { status: 403 })
  }

  const startedAt = Date.now()
  const deleted = await deleteDocument(id)
  if (!deleted) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip: viewer.ip,
    action: 'document_delete',
    details: { id, name: access.document.name, elapsed_ms: Date.now() - startedAt },
  })

  return new Response(null, { status: 204 })
}
