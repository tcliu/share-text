import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchDocument, isDocumentKeyChars } from '$lib/server/documents'
import { getMaxContentLength } from '$lib/server/settings'

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id
  if (!isDocumentKeyChars(id)) {
    throw error(404, 'Document not found')
  }
  const document = await fetchDocument(id)
  if (!document) {
    throw error(404, 'Document not found')
  }
  return { document, maxContentLength: await getMaxContentLength() }
}
