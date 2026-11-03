import type { LayoutServerLoad } from './$types'
import { fetchDocumentSummaries } from '#lib/server/document-store.js'
import { DEFAULT_DOCUMENTS_PAGE_SIZE } from '#lib/documents.js'
import { resolveViewer } from '#lib/server/viewer.js'

export const load: LayoutServerLoad = async ({ cookies, getClientAddress }) => {
  const viewer = await resolveViewer({ cookies, getClientAddress })
  const { documents, hasMore } = await fetchDocumentSummaries({
    limit: DEFAULT_DOCUMENTS_PAGE_SIZE,
    viewer,
  })
  return { documents, hasMore }
}
