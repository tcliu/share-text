import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDocumentAccess, resolveDocumentAccess, setDocumentAccess } from '$lib/server/documents'
import { logEvent } from '$lib/server/logging'
import { isBodyRecord, parseDocumentId } from '$lib/server/request-utils'
import { resolveViewer } from '$lib/server/viewer'

const MAX_SHAREES = 100

export const GET: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canManageAccess) {
    return json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const state = await getDocumentAccess(id)
  if (!state) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  return json({ isPublic: state.isPublic, sharedWith: state.sharedWith })
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress, cookies }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined
  const sharedWith = Array.isArray(body.sharedWith)
    ? body.sharedWith.flatMap(value => (typeof value === 'string' ? [value.trim()] : []))
    : undefined

  if (isPublic === undefined && sharedWith === undefined) {
    return json({ error: 'Request body must include isPublic or sharedWith' }, { status: 400 })
  }
  if (sharedWith !== undefined && sharedWith.length > MAX_SHAREES) {
    return json({ error: `A document can be shared with at most ${MAX_SHAREES} users` }, { status: 400 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canManageAccess) {
    return json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const state = await setDocumentAccess(id, { isPublic, sharedWith })
  if (!state) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  logEvent({
    ip: viewer.ip,
    action: 'document_access_update',
    details: { id, is_public: state.isPublic, shared_with_count: state.sharedWith.length },
  })

  return json({ isPublic: state.isPublic, sharedWith: state.sharedWith })
}
