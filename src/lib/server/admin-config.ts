import { getDb } from './db'

export type AdminPreferences = {
  preferredLanguage: string
}

const PREFERRED_LANGUAGES = new Set(['en', 'zh-CN', 'zh-TW'])

export function normalizeAdminPreferencesInput(body: unknown): AdminPreferences {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const preferredLanguage = record.preferredLanguage
  if (typeof preferredLanguage !== 'string' || !PREFERRED_LANGUAGES.has(preferredLanguage)) {
    throw new Error('Invalid preferredLanguage')
  }
  return { preferredLanguage }
}

export async function getAdminPreferences(username: string): Promise<AdminPreferences> {
  const db = await getDb()
  const result = await db.query<{ preferred_language: string }>(
    'select preferred_language from admin_preferences where username = $1',
    [username],
  )
  return {
    preferredLanguage: result.rows.length > 0 ? result.rows[0].preferred_language : 'en',
  }
}

export async function saveAdminPreferences(username: string, preferences: AdminPreferences): Promise<AdminPreferences> {
  const db = await getDb()
  await db.query(
    `insert into admin_preferences (username, preferred_language, updated_at)
     values ($1, $2, current_timestamp)
     on conflict (username) do update set
       preferred_language = excluded.preferred_language,
       updated_at = current_timestamp`,
    [username, preferences.preferredLanguage],
  )
  return preferences
}
