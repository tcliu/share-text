import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  contentByteSize,
  isUniqueKeyViolation,
  isValidDocumentType,
  normalizeCreatedBy,
  normalizeDocumentKey,
  normalizeName,
  normalizeUpdatedBy,
  type DocumentType,
} from '#lib/server/document-model.js'
import { deleteDocument, fetchDocument, updateDocument } from '#lib/server/document-store.js'
import { fetchDocumentForAdmin } from '#lib/server/document-admin.js'
import { getDocumentAccess, MAX_SHAREES, missingSharees, setDocumentAccess, type DocumentAccessState } from '#lib/server/document-access.js'
import { getDb } from '#lib/server/db/index.js'
import { getMaxContentLength, getMaxDocumentVersions } from '#lib/server/admin-properties.js'
import { logEvent } from '#lib/server/logging.js'
import { isBodyRecord, parseDocumentKey } from '#lib/server/request-utils.js'

export const GET: RequestHandler = async ({ params }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const document = await fetchDocumentForAdmin(id)
  if (!document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const access = await getDocumentAccess(id)
  return Response.json({
    document: {
      ...document,
      sharedWith: access?.sharedWith ?? [],
    },
  })
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return Response.json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }

  const changes: {
    name?: string
    updatedBy?: string
    createdBy?: string
    key?: string
    isPublic?: boolean
    content?: string
    documentType?: DocumentType
    sharedWith?: string[]
  } = {}
  // Resolved before the transaction so `updateDocument` never reaches the
  // settings table (a second connection) while the write transaction is open.
  let maxContentLength: number | undefined
  if (typeof body.name === 'string') {
    try {
      changes.name = normalizeName(body.name)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
    }
  }
  if (typeof body.documentType === 'string') {
    if (!isValidDocumentType(body.documentType)) {
      return Response.json({ error: 'Invalid document type' }, { status: 400 })
    }
    changes.documentType = body.documentType
  }
  if (typeof body.updatedBy === 'string') {
    try {
      changes.updatedBy = normalizeUpdatedBy(body.updatedBy)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid updatedBy' }, { status: 400 })
    }
  }
  if (typeof body.createdBy === 'string') {
    try {
      changes.createdBy = normalizeCreatedBy(body.createdBy)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid createdBy' }, { status: 400 })
    }
  }
  if (typeof body.key === 'string') {
    try {
      changes.key = await normalizeDocumentKey(body.key)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid document key' }, { status: 400 })
    }
  }
  if (typeof body.isPublic === 'boolean') {
    changes.isPublic = body.isPublic
  }
  if (typeof body.content === 'string') {
    try {
      maxContentLength = await getMaxContentLength()
      assertContentWithinLimit(body.content, maxContentLength)
      changes.content = body.content
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid content' }, { status: 400 })
    }
  }
  if (body.sharedWith !== undefined) {
    if (!Array.isArray(body.sharedWith) || body.sharedWith.some(value => typeof value !== 'string')) {
      return Response.json({ error: 'sharedWith must be an array of usernames or emails' }, { status: 400 })
    }
    changes.sharedWith = body.sharedWith.map(value => value.trim()).filter(value => value.length > 0)
  }
  if (
    changes.name === undefined &&
    changes.updatedBy === undefined &&
    changes.createdBy === undefined &&
    changes.key === undefined &&
    changes.isPublic === undefined &&
    changes.content === undefined &&
    changes.documentType === undefined &&
    changes.sharedWith === undefined
  ) {
    return Response.json(
      {
        error:
          'Request body must include a name, updatedBy, createdBy, key, isPublic, content, documentType, or sharedWith',
      },
      { status: 400 },
    )
  }

  const existing = await fetchDocumentForAdmin(id)
  if (!existing) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  if (changes.sharedWith !== undefined) {
    if (changes.sharedWith.length > MAX_SHAREES) {
      return Response.json({ error: `A document can be shared with at most ${MAX_SHAREES} users` }, { status: 400 })
    }
    const missing = await missingSharees(changes.sharedWith, true)
    if (missing.length > 0) {
      return Response.json({ error: `Not shared: ${missing.join(', ')}`, missing }, { status: 400 })
    }
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const { sharedWith, ...documentChanges } = changes
  // Both writes run against one query so a failure in the share rewrite rolls
  // the document update back instead of leaving a partial apply.
  const limits: { maxContentLength?: number; maxDocumentVersions?: number } = {}
  if (maxContentLength !== undefined) {
    limits.maxContentLength = maxContentLength
  }
  if (changes.content !== undefined || changes.documentType !== undefined) {
    limits.maxDocumentVersions = await getMaxDocumentVersions()
  }

  const db = await getDb()
  let updated
  const accessBefore: { state: DocumentAccessState | null } = { state: null }
  try {
    updated = await db.transaction(async query => {
      const document = await updateDocument(id, { ...documentChanges, by: ip }, query, limits)
      if (!document) {
        return null
      }
      if (sharedWith !== undefined) {
        accessBefore.state = await getDocumentAccess(document.id, query)
        const access = await setDocumentAccess(
          document.id,
          { sharedWith },
          { includeInactive: true, query },
        )
        if (!access) {
          throw new Error('Document not found while updating shares')
        }
      }
      return document
    })
  } catch (error) {
    if (isUniqueKeyViolation(error)) {
      return Response.json({ error: 'Document key already exists' }, { status: 409 })
    }
    logEvent({
      ip,
      action: 'admin_document_update_error',
      details: { id, error: error instanceof Error ? error.message : 'Unknown error' },
    })
    throw error
  }
  if (!updated) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const details: Record<string, string | number | boolean> = {
    id,
    content_size: contentByteSize(updated.content),
    elapsed_ms: Date.now() - startedAt,
  }
  if (changes.name !== undefined) {
    details.old_name = existing.name
    details.new_name = changes.name
  }
  if (changes.updatedBy !== undefined) {
    details.old_updated_by = existing.updatedBy
    details.new_updated_by = changes.updatedBy
  }
  if (changes.createdBy !== undefined) {
    details.old_created_by = existing.createdBy
    details.new_created_by = changes.createdBy
  }
  if (changes.key !== undefined) {
    details.old_key = existing.id
    details.new_key = changes.key
  }
  if (changes.isPublic !== undefined) {
    details.old_is_public = existing.isPublic
    details.new_is_public = changes.isPublic
  }
  if (sharedWith !== undefined) {
    details.old_sharees = accessBefore.state?.sharedWith.map(user => user.username).join(', ') ?? ''
    details.new_sharees = sharedWith.join(', ')
  }
  if (changes.content !== undefined) {
    details.old_content_size = contentByteSize(existing.content)
    details.new_content_size = contentByteSize(changes.content)
  }
  // One entry per changed field so every mutation class is greppable by its
  // action even when a single request changes several fields.
  const actions: string[] = []
  if (changes.name !== undefined) actions.push('admin_document_rename')
  if (changes.key !== undefined) actions.push('admin_document_update_key')
  if (changes.content !== undefined) actions.push('admin_document_update_content')
  if (changes.updatedBy !== undefined) actions.push('admin_document_update_updated_by')
  if (changes.createdBy !== undefined) actions.push('admin_document_update_created_by')
  if (changes.isPublic !== undefined) actions.push('admin_document_update_access')
  if (sharedWith !== undefined) actions.push('admin_document_update_shares')
  if (changes.documentType !== undefined) actions.push('admin_document_update_type')
  for (const action of actions) {
    logEvent({ ip, action, details })
  }

  const document = {
    id: updated.id,
    name: updated.name,
    tags: updated.tags,
    documentType: updated.documentType,
    createdBy: changes.createdBy ?? existing.createdBy,
    updatedBy: updated.updatedBy,
    createdAt: existing.createdAt,
    updatedAt: updated.updatedAt,
    contentSize: contentByteSize(updated.content),
    isPublic: changes.isPublic ?? existing.isPublic,
    content: updated.content,
  }
  return Response.json({ document })
}

export const DELETE: RequestHandler = async ({ params, getClientAddress }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const existing = await fetchDocument(id)
  if (!existing) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const deleted = await deleteDocument(id)
  if (!deleted) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip,
    action: 'admin_document_delete',
    details: {
      id,
      name: existing.name,
      content_size: contentByteSize(existing.content),
      elapsed_ms: Date.now() - startedAt,
    },
  })

  return new Response(null, { status: 204 })
}
