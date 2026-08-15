import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  assertContentWithinLimit,
  contentByteSize,
  deleteDocument,
  fetchDocument,
  fetchDocumentForAdmin,
  isUniqueKeyViolation,
  isValidDocumentType,
  normalizeCreatedBy,
  normalizeDocumentKey,
  normalizeName,
  normalizeUpdatedBy,
  updateDocument,
  type DocumentType,
} from '$lib/server/documents'
import { getMaxContentLength } from '$lib/server/settings'
import { logEvent } from '$lib/server/logging'
import { isBodyRecord, parseDocumentId } from '$lib/server/request-utils'

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
  if (!isBodyRecord(body)) {
    return json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }

  const changes: {
    name?: string
    updatedBy?: string
    createdBy?: string
    key?: string
    isPublic?: boolean
    content?: string
    documentType?: DocumentType
  } = {}
  if (typeof body.name === 'string') {
    try {
      changes.name = normalizeName(body.name)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid name' }, { status: 400 })
    }
  }
  if (typeof body.documentType === 'string') {
    if (!isValidDocumentType(body.documentType)) {
      return json({ error: 'Invalid document type' }, { status: 400 })
    }
    changes.documentType = body.documentType
  }
  if (typeof body.updatedBy === 'string') {
    try {
      changes.updatedBy = normalizeUpdatedBy(body.updatedBy)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid updatedBy' }, { status: 400 })
    }
  }
  if (typeof body.createdBy === 'string') {
    try {
      changes.createdBy = normalizeCreatedBy(body.createdBy)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid createdBy' }, { status: 400 })
    }
  }
  if (typeof body.key === 'string') {
    try {
      changes.key = await normalizeDocumentKey(body.key)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid document key' }, { status: 400 })
    }
  }
  if (typeof body.isPublic === 'boolean') {
    changes.isPublic = body.isPublic
  }
  if (typeof body.content === 'string') {
    try {
      assertContentWithinLimit(body.content, await getMaxContentLength())
      changes.content = body.content
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid content' }, { status: 400 })
    }
  }
  if (
    changes.name === undefined &&
    changes.updatedBy === undefined &&
    changes.createdBy === undefined &&
    changes.key === undefined &&
    changes.isPublic === undefined &&
    changes.content === undefined &&
    changes.documentType === undefined
  ) {
    return json(
      { error: 'Request body must include a name, updatedBy, createdBy, key, isPublic, content, or documentType' },
      { status: 400 },
    )
  }

  const existing = await fetchDocumentForAdmin(id)
  if (!existing) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  let updated
  try {
    updated = await updateDocument(id, { ...changes, by: ip })
  } catch (error) {
    if (isUniqueKeyViolation(error)) {
      return json({ error: 'Document key already exists' }, { status: 409 })
    }
    throw error
  }
  if (!updated) {
    return json({ error: 'Document not found' }, { status: 404 })
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
  if (changes.content !== undefined) {
    details.old_content_size = contentByteSize(existing.content)
    details.new_content_size = contentByteSize(changes.content)
  }
  const action =
    changes.key !== undefined
      ? 'admin_document_update_key'
      : changes.content !== undefined
        ? 'admin_document_update_content'
        : changes.updatedBy !== undefined
          ? 'admin_document_update_updated_by'
          : changes.createdBy !== undefined
            ? 'admin_document_update_created_by'
            : changes.isPublic !== undefined
              ? 'admin_document_update_access'
              : changes.documentType !== undefined
                ? 'admin_document_update_type'
                : 'admin_document_rename'
  logEvent({
    ip,
    action,
    details,
  })

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
  const startedAt = Date.now()
  const deleted = await deleteDocument(id)
  if (!deleted) {
    return json({ error: 'Document not found' }, { status: 404 })
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
