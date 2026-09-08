import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logAccess } from '$lib/server/logging'
import { normalizePreferencesInput, getUserPreferences, saveUserPreferences } from '$lib/server/user-config'
import { resolveViewer } from '$lib/server/viewer'

async function resolveUserViewer(event: Parameters<RequestHandler>[0]) {
  const viewer = await resolveViewer(event)
  if (viewer.type !== 'user') {
    return null
  }
  return viewer
}

export const GET: RequestHandler = async event => {
  const viewer = await resolveUserViewer(event)
  if (!viewer) {
    return json({ error: 'Authentication required' }, { status: 401 })
  }
  return json(await getUserPreferences(viewer))
}

export const PUT: RequestHandler = async event => {
  const viewer = await resolveUserViewer(event)
  if (!viewer) {
    return json({ error: 'Authentication required' }, { status: 401 })
  }
  const preferences = await event.request.json().catch(() => null)
  if (preferences === null) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }
  let normalized: ReturnType<typeof normalizePreferencesInput>
  try {
    normalized = normalizePreferencesInput(preferences)
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Invalid preferences' },
      { status: 400 },
    )
  }
  const saved = await saveUserPreferences(viewer, normalized)
  logAccess({
    event,
    action: 'user_preferences_save',
    details: {
      user: viewer.username,
      user_id: viewer.userId,
      preferred_language: saved.preferredLanguage,
    },
  })
  return json(saved)
}