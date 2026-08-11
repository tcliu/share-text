import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchDocument, fetchDocumentVersion } from '$lib/server/documents'
import { parseDocumentId, parseVersionId } from '$lib/server/request-utils'

export const GET: RequestHandler = async ({ params }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const versionId = parseVersionId(params.versionId)
  if (!versionId) {
    return json({ error: 'Version not found' }, { status: 404 })
  }

  const document = await fetchDocument(id)
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const version = await fetchDocumentVersion(id, versionId)
  if (!version) {
    return json({ error: 'Version not found' }, { status: 404 })
  }

  return json({ version })
}
