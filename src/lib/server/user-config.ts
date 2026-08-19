import { getDb } from './db'
import type { Viewer } from './viewer'

export type UserPreferences = {
  preferredLanguage: string
  ttsVoices: Record<string, string>
}

const PREFERRED_LANGUAGES = new Set(['en', 'zh-CN', 'zh-TW'])

export function normalizePreferencesInput(body: unknown): UserPreferences {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const preferredLanguage = record.preferredLanguage
  if (typeof preferredLanguage !== 'string' || !PREFERRED_LANGUAGES.has(preferredLanguage)) {
    throw new Error('Invalid preferredLanguage')
  }
  const ttsVoices: Record<string, string> = {}
  const voices = record.ttsVoices
  if (voices !== undefined && voices !== null) {
    if (typeof voices !== 'object' || Array.isArray(voices)) {
      throw new Error('Invalid ttsVoices')
    }
    for (const [lang, voice] of Object.entries(voices)) {
      if (typeof lang !== 'string' || lang.length === 0) {
        throw new Error('Invalid ttsVoices')
      }
      if (voice !== null && voice !== undefined && voice !== '') {
        if (typeof voice !== 'string') {
          throw new Error('Invalid ttsVoices')
        }
        ttsVoices[lang] = voice
      }
    }
  }
  return { preferredLanguage, ttsVoices }
}

export async function getUserPreferences(viewer: Extract<Viewer, { type: 'user' }>): Promise<UserPreferences> {
  const db = await getDb()
  const prefs = await db.query<{ preferred_language: string }>(
    'select preferred_language from user_preferences where user_id = $1',
    [viewer.userId],
  )
  const voices = await db.query<{ lang: string; voice: string }>(
    'select lang, voice from user_tts_voices where user_id = $1 order by lang',
    [viewer.userId],
  )
  const ttsVoices: Record<string, string> = {}
  for (const row of voices.rows) {
    ttsVoices[String(row.lang)] = String(row.voice)
  }
  return {
    preferredLanguage: prefs.rows.length > 0 ? prefs.rows[0].preferred_language : 'en',
    ttsVoices,
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
    await query('delete from user_tts_voices where user_id = $1', [viewer.userId])
    for (const [lang, voice] of Object.entries(preferences.ttsVoices)) {
      await query(
        `insert into user_tts_voices (user_id, lang, voice, updated_at)
         values ($1, $2, $3, current_timestamp)`,
        [viewer.userId, lang, voice],
      )
    }
  })
  return preferences
}