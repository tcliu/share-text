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

export async function* synthesizeTtsStreaming(
  segments: Array<{ text: string; lang: string }>,
  signal?: AbortSignal,
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
    while (!failure && launched < segments.length && launched - finished < SYNTHESIS_CONCURRENCY) {
      const index = launched
      launched += 1
      const segment = segments[index]
      synthesizeOneCached(segment.text, segment.lang, signal)
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
  segments: Array<{ text: string; lang: string }>,
  signal?: AbortSignal,
): Promise<Blob[]> {
  const results: Blob[] = []
  for await (const blob of synthesizeTtsStreaming(segments, signal)) {
    results.push(blob)
  }
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
