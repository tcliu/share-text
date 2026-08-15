import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import { exportUsersForAdmin } from '$lib/server/users'

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  const idsParam = url.searchParams.get('ids')
  const ids: number[] = []
  if (idsParam) {
    for (const raw of idsParam.split(',')) {
      const id = Number(raw.trim())
      if (!Number.isInteger(id) || id <= 0) {
        return json({ error: 'Invalid user id in export selection' }, { status: 400 })
      }
      ids.push(id)
    }
  }

  const ip = getClientAddress()
  const startedAt = Date.now()
  const records = await exportUsersForAdmin(ids.length > 0 ? ids : undefined)
  logEvent({
    ip,
    action: 'admin_user_export',
    details: { count: records.length, elapsed_ms: Date.now() - startedAt },
  })
  return json(records)
}
