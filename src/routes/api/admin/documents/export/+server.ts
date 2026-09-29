import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { exportDocumentsForAdmin } from '$lib/server/document-admin'
import { logEvent } from '$lib/server/logging'
import { parseDocumentKey } from '$lib/server/request-utils'

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  const idsParam = url.searchParams.get('ids')
  const ids: string[] = []
  if (idsParam) {
    for (const raw of idsParam.split(',')) {
      const id = await parseDocumentKey(raw.trim())
      if (!id) {
        return json({ error: 'Invalid document id in export selection' }, { status: 400 })
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
  return json(records)
}
