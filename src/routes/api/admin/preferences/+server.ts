import type { RequestHandler } from './$types'
import { getAdminUsername } from '#lib/server/admin-auth.js'
import { getAdminPreferences, normalizeAdminPreferencesInput, saveAdminPreferences } from '#lib/server/admin-config.js'
import { logEvent } from '#lib/server/logging.js'

export const GET: RequestHandler = async () => {
  return Response.json(await getAdminPreferences(getAdminUsername()))
}

export const PUT: RequestHandler = async ({ request, getClientAddress }) => {
  const ip = getClientAddress()
  const body = await request.json().catch(() => ({}))
  try {
    const preferences = normalizeAdminPreferencesInput(body)
    const saved = await saveAdminPreferences(getAdminUsername(), preferences)
    logEvent({
      ip,
      action: 'admin_preferences_save',
      details: { username: getAdminUsername(), preferred_language: saved.preferredLanguage },
    })
    return Response.json(saved)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid preferences' }, { status: 400 })
  }
}
