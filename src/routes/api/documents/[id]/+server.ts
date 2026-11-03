import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  contentByteSize,
  isValidDocumentType,
  normalizeName,
} from '#lib/server/document-model.js'
import { deleteDocument, updateDocument } from '#lib/server/document-store.js'
import { resolveDocumentAccess } from '#lib/server/document-access.js'
import { logEvent } from '#lib/server/logging.js'
import { isBodyRecord, parseDocumentKey } from '#lib/server/request-utils.js'
import { getMaxContentLength } from '#lib/server/admin-properties.js'
import { getDefaultTagColor, isTagColor, type Tag } from '#lib/tag-colors.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const GET: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const { document, canView } = await resolveDocumentAccess(id, viewer)
  if (!document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!canView) {
    return Response.json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  return Response.json({ document })
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress, cookies }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const bodyKeys = Object.keys(body)
  if (bodyKeys.some(key => key !== 'name' && key !== 'content' && key !== 'documentType' && key !== 'tags')) {
    return Response.json({ error: 'Unsupported fields in request body' }, { status: 400 })
  }

  if (body.name !== undefined && typeof body.name !== 'string') {
    return Response.json({ error: 'name must be a string' }, { status: 400 })
  }
  if (body.content !== undefined && typeof body.content !== 'string') {
    return Response.json({ error: 'content must be a string' }, { status: 400 })
  }
  if (body.documentType !== undefined && typeof body.documentType !== 'string') {
    return Response.json({ error: 'documentType must be a string' }, { status: 400 })
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return Response.json({ error: 'tags must be an array' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name : undefined
  const content = typeof body.content === 'string' ? body.content : undefined
  const docType = typeof body.documentType === 'string' ? body.documentType : undefined
  let tags: Tag[] | undefined
  if (Array.isArray(body.tags)) {
    tags = []
    for (let i = 0; i < body.tags.length; i++) {
      const tag = body.tags[i]
      if (typeof tag === 'string') {
        tags.push({ name: tag, color: getDefaultTagColor(tag) })
        continue
      }
      if (tag === null || typeof tag !== 'object' || typeof (tag as { name?: unknown }).name !== 'string') {
        return Response.json({ error: `tags[${i}] must be a string or an object with a name` }, { status: 400 })
      }
      const tagName = (tag as { name: string }).name
      const rawColor = (tag as { color?: unknown }).color
      const color = typeof rawColor === 'string' && isTagColor(rawColor) ? rawColor : getDefaultTagColor(tagName)
      tags.push({ name: tagName, color })
    }
  }

  if (name === undefined && content === undefined && docType === undefined && tags === undefined) {
    return Response.json({ error: 'Request body must include name, content, documentType, or tags' }, { status: 400 })
  }

  if (name !== undefined) {
    try {
      normalizeName(name)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
    }
  }

  if (content !== undefined) {
    try {
      assertContentWithinLimit(content, await getMaxContentLength())
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid content' }, { status: 400 })
    }
  }

  if (docType !== undefined && !isValidDocumentType(docType)) {
    return Response.json({ error: 'Invalid document type' }, { status: 400 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canEdit) {
    return Response.json(
      { error: 'You do not have permission to edit this document' },
      { status: viewer.type === 'anonymous' ? 404 : 403 },
    )
  }

  const startedAt = Date.now()
  const document = await updateDocument(id, { name, content, documentType: docType, tags, by: viewer.name })
  if (!document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const details: Record<string, unknown> = {
    id,
    name: document.name,
    elapsed_ms: Date.now() - startedAt,
    content_size: contentByteSize(document.content),
  }
  if (document.documentType !== undefined) {
    details.type = document.documentType
  }
  logEvent({ ip: viewer.ip, action: 'document_save', details })

  return Response.json({ document })
}

export const DELETE: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canDelete) {
    return Response.json(
      { error: 'You do not have permission to delete this document' },
      { status: viewer.type === 'anonymous' ? 404 : 403 },
    )
  }

  const startedAt = Date.now()
  try {
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
  } catch (error) {
    logEvent({
      ip: viewer.ip,
      action: 'document_delete_error',
      details: {
        id,
        name: access.document.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsed_ms: Date.now() - startedAt,
      },
    })
    throw error
  }
}
