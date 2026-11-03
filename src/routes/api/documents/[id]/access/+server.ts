import type { RequestHandler } from './$types'
import {
  getDocumentAccess,
  MAX_SHAREES,
  missingSharees,
  resolveDocumentAccess,
  setDocumentAccess,
} from '#lib/server/document-access.js'
import { logEvent } from '#lib/server/logging.js'
import { isBodyRecord, parseDocumentKey } from '#lib/server/request-utils.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const GET: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canManageAccess) {
    return Response.json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const state = await getDocumentAccess(id)
  if (!state) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  return Response.json({ isPublic: state.isPublic, sharedWith: state.sharedWith })
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

  const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined
  if (body.sharedWith !== undefined) {
    if (!Array.isArray(body.sharedWith) || body.sharedWith.some(value => typeof value !== 'string')) {
      return Response.json({ error: 'sharedWith must be an array of strings' }, { status: 400 })
    }
  }
  const sharedWith = body.sharedWith?.map(value => value.trim())

  if (isPublic === undefined && sharedWith === undefined) {
    return Response.json({ error: 'Request body must include isPublic or sharedWith' }, { status: 400 })
  }
  if (sharedWith !== undefined && sharedWith.length > MAX_SHAREES) {
    return Response.json({ error: `A document can be shared with at most ${MAX_SHAREES} users` }, { status: 400 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canManageAccess) {
    return Response.json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const includeInactive = viewer.type === 'admin'
  let missing: string[] = []
  if (sharedWith !== undefined) {
    missing = await missingSharees(sharedWith, includeInactive)
    if (missing.length > 0) {
      return Response.json({ error: `Not shared: ${missing.join(', ')}`, missing }, { status: 400 })
    }
  }

  const state = await setDocumentAccess(id, { isPublic, sharedWith }, { includeInactive })
  if (!state) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip: viewer.ip,
    action: 'document_access_update',
    details: { id, is_public: state.isPublic, shared_with_count: state.sharedWith.length },
  })

  return Response.json({ isPublic: state.isPublic, sharedWith: state.sharedWith })
}
