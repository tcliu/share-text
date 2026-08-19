import type { Locale } from './i18n.svelte'

export interface AdminPreferences {
  preferredLanguage: Locale
}

function parseLocale(value: unknown): Locale {
  return value === 'en' || value === 'zh-CN' || value === 'zh-TW' ? value : 'en'
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}))
  return typeof data.error === 'string' ? data.error : fallback
}

async function ensureOk(response: Response, fallback: string): Promise<Response> {
  if (response.status === 401) {
    throw new Error('Admin authentication required')
  }
  if (!response.ok) {
    throw new Error(await readError(response, fallback))
  }
  return response
}

function parseAdminPreferences(data: unknown): AdminPreferences {
  const record = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return { preferredLanguage: parseLocale(record.preferredLanguage) }
}

export async function fetchAdminPreferences(): Promise<AdminPreferences> {
  const response = await ensureOk(await fetch('/api/admin/preferences'), 'Failed to load admin preferences')
  return parseAdminPreferences(await response.json())
}

export async function saveAdminPreferences(preferences: AdminPreferences): Promise<AdminPreferences> {
  const response = await ensureOk(
    await fetch('/api/admin/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    }),
    'Failed to save admin preferences',
  )
  return parseAdminPreferences(await response.json())
}
