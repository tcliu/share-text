import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchDocumentVersion, resolveDocumentAccess } from '$lib/server/documents'
import { parseDocumentId, parseVersionId } from '$lib/server/request-utils'
import { resolveViewer } from '$lib/server/viewer'

export const GET: RequestHandler = async ({ params, getClientAddress, cookies }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const versionId = parseVersionId(params.versionId)
  if (!versionId) {
    return json({ error: 'Version not found' }, { status: 404 })
  }

  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }
  if (!access.canView) {
    return json({ error: 'Document not found' }, { status: viewer.type === 'anonymous' ? 404 : 403 })
  }

  const version = await fetchDocumentVersion(id, versionId)
  if (!version) {
    return json({ error: 'Version not found' }, { status: 404 })
  }

  return json({ version })
}
