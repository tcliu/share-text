import type { LayoutServerLoad } from './$types'
import { fetchDocumentSummaries } from '$lib/server/documents'
import { DEFAULT_DOCUMENTS_PAGE_SIZE } from '$lib/documents'

export const load: LayoutServerLoad = async ({ getClientAddress }) => {
  const { documents, hasMore } = await fetchDocumentSummaries({
    limit: DEFAULT_DOCUMENTS_PAGE_SIZE,
    viewerBy: getClientAddress(),
  })
  return { documents, hasMore }
}
