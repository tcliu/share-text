import { MAX_SEGMENT_LENGTH } from './tts-language'

export interface TtsVoices {
  [lang: string]: string[]
}

export interface TtsCapabilities {
  configured: boolean
  languages: string[]
  voices: TtsVoices
  maxSegmentLength: number
  synthesisConcurrency: number
}

const CAPABILITIES_CACHE_TTL_MS = 60_000
let cachedCapabilities: { value: Promise<TtsCapabilities>; expiresAt: number } | null = null

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

function unconfiguredCapabilities(): TtsCapabilities {
  return {
    configured: false,
    languages: [],
    voices: {},
    maxSegmentLength: MAX_SEGMENT_LENGTH,
    synthesisConcurrency: SYNTHESIS_CONCURRENCY,
  }
}

export function clearCapabilitiesCache() {
  cachedCapabilities = null
}

export function loadTtsCapabilities(): Promise<TtsCapabilities> {
  const now = Date.now()
  if (cachedCapabilities && cachedCapabilities.expiresAt > now) {
    return cachedCapabilities.value
  }
  const promise: Promise<TtsCapabilities> = Promise.resolve()
    .then(() => fetch('/api/tts/capabilities'))
    .then(async response => {
      if (!response.ok) {
        return unconfiguredCapabilities()
      }
      const data = (await response.json()) as Partial<TtsCapabilities>
      const voices: TtsVoices = {}
      if (data.voices && typeof data.voices === 'object') {
        for (const [lang, list] of Object.entries(data.voices)) {
          if (Array.isArray(list)) {
            voices[lang] = list.filter((voice): voice is string => typeof voice === 'string')
          }
        }
      }
      return {
        configured: Boolean(data.configured),
        languages: Array.isArray(data.languages) ? data.languages : [],
        voices,
        maxSegmentLength: positiveInt(data.maxSegmentLength, MAX_SEGMENT_LENGTH),
        synthesisConcurrency: positiveInt(data.synthesisConcurrency, SYNTHESIS_CONCURRENCY),
      }
    })
    .catch(unconfiguredCapabilities)
  cachedCapabilities = { value: promise, expiresAt: now + CAPABILITIES_CACHE_TTL_MS }
  return promise
}

export interface TtsSegmentMeta {
  segmentIndex?: number
  indexStart?: number
  indexEnd?: number
}

export interface TtsSegmentInput extends TtsSegmentMeta {
  text: string
  lang: string
  voice?: string
}

export async function synthesizeTts(
  text: string,
  lang: string,
  signal?: AbortSignal,
  meta?: TtsSegmentMeta,
  voice?: string,
): Promise<Blob> {
  const body: Record<string, string | number> = { text, lang }
  if (voice) {
    body.voice = voice
  }
  const response = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, ...meta }),
    signal,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to synthesize speech')
  }
  return response.blob()
}

const SYNTHESIS_CACHE_LIMIT = 100
export const SYNTHESIS_CONCURRENCY = 4
const synthesisCache = new Map<string, Blob>()

export async function* synthesizeTtsStreaming(
  segments: TtsSegmentInput[],
  signal?: AbortSignal,
  concurrency: number = SYNTHESIS_CONCURRENCY,
): AsyncGenerator<Blob, void, undefined> {
  const blobs: Array<Blob | undefined> = new Array(segments.length)
  let nextToYield = 0
  let launched = 0
  let finished = 0
  let failure: unknown = null
  const waiters: Array<() => void> = []
  const wake = () => {
    for (const fn of waiters.splice(0)) fn()
  }

  function launchNext() {
    while (!failure && launched < segments.length && launched - finished < concurrency) {
      const index = launched
      launched += 1
      const segment = segments[index]
      synthesizeOneCached(segment.text, segment.lang, signal, segment.voice, {
        segmentIndex: index,
        indexStart: segment.indexStart,
        indexEnd: segment.indexEnd,
      })
        .then(blob => {
          blobs[index] = blob
        })
        .catch(err => {
          failure = err
        })
        .finally(() => {
          finished += 1
          launchNext()
          wake()
        })
    }
  }

  launchNext()
  while (nextToYield < segments.length) {
    if (failure) throw failure
    const next = blobs[nextToYield]
    if (next) {
      yield next
      nextToYield += 1
      continue
    }
    await new Promise<void>(resolve => waiters.push(() => resolve()))
  }
}

export async function synthesizeTtsCached(
  segments: TtsSegmentInput[],
  signal?: AbortSignal,
  concurrency: number = SYNTHESIS_CONCURRENCY,
): Promise<Blob[]> {
  const results: Blob[] = []
  for await (const blob of synthesizeTtsStreaming(segments, signal, concurrency)) {
    results.push(blob)
  }
  return results
}

async function synthesizeOneCached(
  text: string,
  lang: string,
  signal?: AbortSignal,
  voice?: string,
  meta?: TtsSegmentMeta,
): Promise<Blob> {
  const key = `${lang}\u0000${voice ?? ''}\u0000${text}`
  const cached = synthesisCache.get(key)
  if (cached) {
    return cached
  }
  const blob = await synthesizeTts(text, lang, signal, meta, voice)
  synthesisCache.set(key, blob)
  if (synthesisCache.size > SYNTHESIS_CACHE_LIMIT) {
    const oldestKey = synthesisCache.keys().next().value
    if (oldestKey !== undefined) {
      synthesisCache.delete(oldestKey)
    }
  }
  return blob
}

export function clearSynthesisCache() {
  synthesisCache.clear()
}
