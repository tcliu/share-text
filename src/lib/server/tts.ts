import { getSettingStringValue } from './settings'

const FALLBACK_LANGS = ['en', 'en_gb', 'zh', 'ja']
const CAPABILITIES_CACHE_TTL_MS = 60_000
const FALLBACK_CACHE_TTL_MS = 10_000

let cachedLanguages: { languages: string[]; expiresAt: number } | null = null

export async function getTtsServiceUrl(): Promise<string> {
  return (await getSettingStringValue('tts_service_url')).trim()
}

export async function isTtsConfigured(): Promise<boolean> {
  return Boolean(await getTtsServiceUrl())
}

export async function getSupportedTtsLanguages(): Promise<string[]> {
  const now = Date.now()
  if (cachedLanguages && cachedLanguages.expiresAt > now) {
    return cachedLanguages.languages
  }
  try {
    const url = await getTtsServiceUrl()
    if (!url) {
      cachedLanguages = { languages: FALLBACK_LANGS, expiresAt: now + FALLBACK_CACHE_TTL_MS }
      return FALLBACK_LANGS
    }
    const response = await fetch(`${url}/api/capabilities`)
    if (response.ok) {
      const data = (await response.json()) as { languages?: string[] }
      const languages = Array.isArray(data.languages) ? data.languages : FALLBACK_LANGS
      cachedLanguages = { languages, expiresAt: now + CAPABILITIES_CACHE_TTL_MS }
      return languages
    }
  } catch {
    // fall through to the default set
  }
  cachedLanguages = { languages: FALLBACK_LANGS, expiresAt: now + FALLBACK_CACHE_TTL_MS }
  return FALLBACK_LANGS
}

export function clearTtsLanguageCache() {
  cachedLanguages = null
}
