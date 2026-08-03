import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchDocument, isDocumentKey } from '$lib/server/documents'
import { getDocumentKeyLength, getMaxContentLength } from '$lib/server/settings'

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id
  const keyLength = await getDocumentKeyLength()
  if (!isDocumentKey(id, keyLength)) {
    throw error(404, 'Document not found')
  }
  const document = await fetchDocument(id)
  if (!document) {
    throw error(404, 'Document not found')
  }
  return { document, maxContentLength: await getMaxContentLength() }
}
