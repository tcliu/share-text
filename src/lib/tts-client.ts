export interface TtsCapabilities {
  configured: boolean
  languages: string[]
}

const CAPABILITIES_CACHE_TTL_MS = 60_000
let cachedCapabilities: { value: Promise<TtsCapabilities>; expiresAt: number } | null = null

export function loadTtsCapabilities(): Promise<TtsCapabilities> {
  const now = Date.now()
  if (cachedCapabilities && cachedCapabilities.expiresAt > now) {
    return cachedCapabilities.value
  }
  const promise: Promise<TtsCapabilities> = Promise.resolve()
    .then(() => fetch('/api/tts/capabilities'))
    .then(async response => {
      if (!response.ok) {
        return { configured: false, languages: [] }
      }
      const data = (await response.json()) as Partial<TtsCapabilities>
      return {
        configured: Boolean(data.configured),
        languages: Array.isArray(data.languages) ? data.languages : [],
      }
    })
    .catch(() => ({ configured: false, languages: [] }))
  cachedCapabilities = { value: promise, expiresAt: now + CAPABILITIES_CACHE_TTL_MS }
  return promise
}

export async function synthesizeTts(text: string, lang: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
    signal,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to synthesize speech')
  }
  return response.blob()
}

const SYNTHESIS_CACHE_LIMIT = 100
const SYNTHESIS_CONCURRENCY = 4
const synthesisCache = new Map<string, Blob>()

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0
  async function next() {
    while (index < items.length) {
      const current = index
      index += 1
      await worker(items[current], current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()))
}

export async function synthesizeTtsCached(
  segments: Array<{ text: string; lang: string }>,
  signal?: AbortSignal,
): Promise<Blob[]> {
  const results: Blob[] = new Array(segments.length)
  await runWithConcurrency(segments, SYNTHESIS_CONCURRENCY, async ({ text, lang }, index) => {
    results[index] = await synthesizeOneCached(text, lang, signal)
  })
  return results
}

async function synthesizeOneCached(text: string, lang: string, signal?: AbortSignal): Promise<Blob> {
  const key = `${lang}\u0000${text}`
  const cached = synthesisCache.get(key)
  if (cached) {
    return cached
  }
  const blob = await synthesizeTts(text, lang, signal)
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
