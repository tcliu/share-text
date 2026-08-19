import { getSettingStringValue } from './settings'

const FALLBACK_LANGS = ['en', 'en_gb', 'zh', 'ja']
const CAPABILITIES_CACHE_TTL_MS = 60_000
const FALLBACK_CACHE_TTL_MS = 10_000

export interface TtsVoices {
  [lang: string]: string[]
}

interface CachedCapabilities {
  languages: string[]
  voices: TtsVoices
  expiresAt: number
}

let cachedCapabilities: CachedCapabilities | null = null

export async function getTtsServiceUrl(): Promise<string> {
  return (await getSettingStringValue('tts_service_url')).trim()
}

export async function isTtsConfigured(): Promise<boolean> {
  return Boolean(await getTtsServiceUrl())
}

async function loadCapabilities(): Promise<CachedCapabilities> {
  const now = Date.now()
  if (cachedCapabilities && cachedCapabilities.expiresAt > now) {
    return cachedCapabilities
  }
  const fallback = (): CachedCapabilities => ({
    languages: FALLBACK_LANGS,
    voices: {},
    expiresAt: now + FALLBACK_CACHE_TTL_MS,
  })
  try {
    const url = await getTtsServiceUrl()
    if (!url) {
      cachedCapabilities = fallback()
      return cachedCapabilities
    }
    const response = await fetch(`${url}/api/capabilities`)
    if (response.ok) {
      const data = (await response.json()) as { languages?: string[]; voices?: TtsVoices }
      const voices: TtsVoices = {}
      if (data.voices && typeof data.voices === 'object') {
        for (const [lang, list] of Object.entries(data.voices)) {
          if (Array.isArray(list)) {
            voices[lang] = list.filter((voice): voice is string => typeof voice === 'string')
          }
        }
      }
      cachedCapabilities = {
        languages: Array.isArray(data.languages) ? data.languages : FALLBACK_LANGS,
        voices,
        expiresAt: now + CAPABILITIES_CACHE_TTL_MS,
      }
      return cachedCapabilities
    }
  } catch {
    // fall through to the default set
  }
  cachedCapabilities = fallback()
  return cachedCapabilities
}

export async function getSupportedTtsLanguages(): Promise<string[]> {
  return (await loadCapabilities()).languages
}

export async function getSupportedTtsVoices(): Promise<TtsVoices> {
  return (await loadCapabilities()).voices
}

export function clearTtsLanguageCache() {
  cachedCapabilities = null
}
