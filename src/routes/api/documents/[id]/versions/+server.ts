import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchDocument, fetchDocumentVersions } from '$lib/server/documents'
import { parseDocumentId } from '$lib/server/request-utils'

export const GET: RequestHandler = async ({ params }) => {
  const id = await parseDocumentId(params.id)
  if (!id) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  const document = await fetchDocument(id)
  if (!document) {
    return json({ error: 'Document not found' }, { status: 404 })
  }

  return json({ versions: await fetchDocumentVersions(id) })
}
