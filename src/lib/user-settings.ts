import type { Locale } from './i18n.svelte'

export interface UserPreferences {
  preferredLanguage: Locale
}

export class UserSettingsAuthError extends Error {}

function parseLocale(value: unknown): Locale {
  return value === 'en' || value === 'zh-CN' || value === 'zh-TW' ? value : 'en'
}

export function parseUserPreferences(data: unknown): UserPreferences {
  const record = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return { preferredLanguage: parseLocale(record.preferredLanguage) }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}))
  return typeof data.error === 'string' ? data.error : fallback
}

async function ensureOk(response: Response, fallback: string): Promise<Response> {
  if (response.status === 401) {
    throw new UserSettingsAuthError('Authentication required')
  }
  if (!response.ok) {
    throw new Error(await readError(response, fallback))
  }
  return response
}

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const response = await ensureOk(await fetch('/api/user/preferences'), 'Failed to load preferences')
  return parseUserPreferences(await response.json())
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const response = await ensureOk(
    await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    }),
    'Failed to save preferences',
  )
  return parseUserPreferences(await response.json())
}
