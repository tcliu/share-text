import type { RequestHandler } from './$types'
import { exportDocumentsForAdmin } from '#lib/server/document-admin.js'
import { logEvent } from '#lib/server/logging.js'
import { parseDocumentKey } from '#lib/server/request-utils.js'

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  const idsParam = url.searchParams.get('ids')
  const ids: string[] = []
  if (idsParam) {
    for (const raw of idsParam.split(',')) {
      const id = await parseDocumentKey(raw.trim())
      if (!id) {
        return Response.json({ error: 'Invalid document id in export selection' }, { status: 400 })
      }
      ids.push(id)
    }
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const records = await exportDocumentsForAdmin(ids.length > 0 ? ids : undefined)
  logEvent({
    ip,
    action: 'admin_document_export',
    details: { count: records.length, elapsed_ms: Date.now() - startedAt },
  })
  return Response.json(records)
}
