import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAdminUsername } from '$lib/server/admin-auth'
import {
  getAdminPreferences,
  normalizeAdminPreferencesInput,
  saveAdminPreferences,
} from '$lib/server/admin-config'
import { logEvent } from '$lib/server/logging'

export const GET: RequestHandler = async () => {
  return json(await getAdminPreferences(getAdminUsername()))
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
    return json(saved)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid preferences' }, { status: 400 })
  }
}
