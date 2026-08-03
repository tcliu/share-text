import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchDocument, isDocumentKey, MAX_CONTENT_LENGTH } from '$lib/server/documents'

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id
  if (!isDocumentKey(id)) {
    throw error(404, 'Document not found')
  }
  const document = await fetchDocument(id)
  if (!document) {
    throw error(404, 'Document not found')
  }
  return { document, maxContentLength: MAX_CONTENT_LENGTH }
}
