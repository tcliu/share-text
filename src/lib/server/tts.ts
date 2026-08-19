import { getSettingStringValue } from './settings'

const FALLBACK_LANGS = ['en', 'en_gb', 'zh', 'ja']
const CAPABILITIES_CACHE_TTL_MS = 60_000
const FALLBACK_CACHE_TTL_MS = 10_000

export interface TtsVoices {
  [lang: string]: string[]
}

export interface TtsDefaultVoices {
  [lang: string]: string
}

export interface AdminTtsVoicesState {
  configured: boolean
  languages: string[]
  voices: TtsVoices
  defaultVoices: Record<string, string>
}

interface CachedCapabilities {
  languages: string[]
  voices: TtsVoices
  defaultVoices: TtsDefaultVoices
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
    defaultVoices: {},
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
      const data = (await response.json()) as { languages?: string[]; voices?: TtsVoices; defaultVoices?: TtsDefaultVoices }
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
        defaultVoices: normalizeDefaultVoices(data.defaultVoices),
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

export async function getSupportedTtsDefaultVoices(): Promise<TtsDefaultVoices> {
  return (await loadCapabilities()).defaultVoices
}

function normalizeVoices(value: unknown): TtsVoices {
  const voices: TtsVoices = {}
  if (value && typeof value === 'object') {
    for (const [lang, list] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        voices[lang] = list.filter((voice): voice is string => typeof voice === 'string')
      }
    }
  }
  return voices
}

function normalizeDefaultVoices(value: unknown): Record<string, string> {
  const defaults: Record<string, string> = {}
  if (value && typeof value === 'object') {
    for (const [lang, voice] of Object.entries(value as Record<string, unknown>)) {
      if (typeof voice === 'string' && voice) {
        defaults[lang] = voice
      }
    }
  }
  return defaults
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}))
  if (typeof body === 'object' && body !== null) {
    if (typeof body.error === 'string') return body.error
    if (typeof body.detail === 'string') return body.detail
  }
  return fallback
}

async function requestTtsService(path: string, init?: RequestInit): Promise<Response> {
  const url = await getTtsServiceUrl()
  if (!url) {
    throw new Error('Text-to-speech is not configured')
  }
  try {
    return await fetch(`${url}${path}`, init)
  } catch {
    throw new Error('TTS service is unreachable')
  }
}

function normalizeAdminState(data: unknown): AdminTtsVoicesState {
  const record = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return {
    configured: true,
    languages: Array.isArray(record.languages) ? record.languages.filter((lang): lang is string => typeof lang === 'string') : [],
    voices: normalizeVoices(record.voices),
    defaultVoices: normalizeDefaultVoices(record.defaultVoices),
  }
}

export async function getAdminTtsVoicesState(): Promise<AdminTtsVoicesState> {
  const url = await getTtsServiceUrl()
  if (!url) {
    return {
      configured: false,
      languages: FALLBACK_LANGS,
      voices: {},
      defaultVoices: {},
    }
  }
  const response = await fetch(`${url}/api/admin/voices`)
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load TTS voices'))
  }
  return normalizeAdminState(await response.json())
}

export async function saveAdminTtsDefaultVoices(defaultVoices: Record<string, string | null>): Promise<AdminTtsVoicesState> {
  const response = await requestTtsService('/api/admin/voices/defaults', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ default_voices: defaultVoices }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to save TTS default voices'))
  }
  clearTtsLanguageCache()
  return normalizeAdminState(await response.json())
}

export async function uploadAdminTtsVoice(formData: FormData): Promise<AdminTtsVoicesState> {
  const response = await requestTtsService('/api/admin/voices', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to upload TTS voice'))
  }
  clearTtsLanguageCache()
  return normalizeAdminState(await response.json())
}

export async function deleteAdminTtsVoice(lang: string, voice: string): Promise<AdminTtsVoicesState> {
  const response = await requestTtsService(`/api/admin/voices?lang=${encodeURIComponent(lang)}&voice=${encodeURIComponent(voice)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to delete TTS voice'))
  }
  clearTtsLanguageCache()
  return normalizeAdminState(await response.json())
}

export function clearTtsLanguageCache() {
  cachedCapabilities = null
}
