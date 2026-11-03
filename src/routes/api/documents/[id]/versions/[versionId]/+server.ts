import type { RequestHandler } from './$types'
import { fetchDocumentVersion } from '#lib/server/document-versions.js'
import { resolveDocumentAccess } from '#lib/server/document-access.js'
import { parseDocumentKey, parseVersionId } from '#lib/server/request-utils.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const GET: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentKey(params.id)
  if (!id) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const versionId = parseVersionId(params.versionId)
  if (!versionId) {
    return Response.json({ error: 'Version not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canView) {
    return Response.json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const version = await fetchDocumentVersion(id, versionId)
  if (!version) {
    return Response.json({ error: 'Version not found' }, { status: 404 })
  }

  return Response.json({ version })
}
