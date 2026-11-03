import type { RequestHandler } from './$types'
import { logAccess } from '#lib/server/logging.js'
import { normalizePreferencesInput, getUserPreferences, saveUserPreferences } from '#lib/server/user-config.js'
import { resolveViewer } from '#lib/server/viewer.js'

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
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  return Response.json(await getUserPreferences(viewer))
}

export const PUT: RequestHandler = async event => {
  const viewer = await resolveUserViewer(event)
  if (!viewer) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const preferences = await event.request.json().catch(() => null)
  if (preferences === null) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  let normalized: ReturnType<typeof normalizePreferencesInput>
  try {
    normalized = normalizePreferencesInput(preferences)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid preferences' }, { status: 400 })
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
  return Response.json(saved)
}
