import { getDb } from './db'
import type { Viewer } from './viewer'

export type UserPreferences = {
  preferredLanguage: string
}

const PREFERRED_LANGUAGES = new Set(['en', 'zh-CN', 'zh-TW'])

export function normalizePreferencesInput(body: unknown): UserPreferences {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const preferredLanguage = record.preferredLanguage
  if (typeof preferredLanguage !== 'string' || !PREFERRED_LANGUAGES.has(preferredLanguage)) {
    throw new Error('Invalid preferredLanguage')
  }
  return { preferredLanguage }
}

export async function getUserPreferences(viewer: Extract<Viewer, { type: 'user' }>): Promise<UserPreferences> {
  const db = await getDb()
  const prefs = await db.query<{ preferred_language: string }>(
    'select preferred_language from user_preferences where user_id = $1',
    [viewer.userId],
  )
  return {
    preferredLanguage: prefs.rows.length > 0 ? prefs.rows[0].preferred_language : 'en',
  }
}

export async function saveUserPreferences(
  viewer: Extract<Viewer, { type: 'user' }>,
  preferences: UserPreferences,
): Promise<UserPreferences> {
  const db = await getDb()
  await db.transaction(async query => {
    await query(
      `insert into user_preferences (user_id, preferred_language, updated_at)
       values ($1, $2, current_timestamp)
       on conflict (user_id) do update set
         preferred_language = excluded.preferred_language,
         updated_at = current_timestamp`,
      [viewer.userId, preferences.preferredLanguage],
    )
  })
  return preferences
}