// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCapabilitiesCache,
  clearSynthesisCache,
  loadTtsCapabilities,
  synthesizeTtsCached,
  synthesizeTtsStreaming,
} from '../tts-client'

function audioBlob() {
  return new Blob(['audio-data'])
}

beforeEach(() => {
  vi.unstubAllGlobals()
  clearSynthesisCache()
  clearCapabilitiesCache()
})

describe('loadTtsCapabilities', () => {
  it('parses the runtime TTS settings from the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        configured: true,
        languages: ['en', 'zh'],
        maxSegmentLength: 300,
        synthesisConcurrency: 2,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadTtsCapabilities()).toEqual({
      configured: true,
      languages: ['en', 'zh'],
      voices: {},
      defaultVoices: {},
      maxSegmentLength: 300,
      synthesisConcurrency: 2,
    })
  })

  it('parses the per-language voices from the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        configured: true,
        languages: ['en', 'zh'],
        voices: {
          en: ['en_US-lessac-medium.onnx', 'en_GB-alba-medium.onnx'],
          zh: ['zh_CN-huayan-medium.onnx'],
        },
        defaultVoices: {
          en: 'en_US-lessac-medium.onnx',
        },
        maxSegmentLength: 300,
        synthesisConcurrency: 2,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadTtsCapabilities()).toEqual({
      configured: true,
      languages: ['en', 'zh'],
      voices: {
        en: ['en_US-lessac-medium.onnx', 'en_GB-alba-medium.onnx'],
        zh: ['zh_CN-huayan-medium.onnx'],
      },
      defaultVoices: {
        en: 'en_US-lessac-medium.onnx',
      },
      maxSegmentLength: 300,
      synthesisConcurrency: 2,
    })
  })

  it('falls back to the built-in defaults when the response omits the settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false, languages: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadTtsCapabilities()).toEqual({
      configured: false,
      languages: [],
      voices: {},
      defaultVoices: {},
      maxSegmentLength: 500,
      synthesisConcurrency: 4,
    })
  })
})

describe('synthesizeTtsCached', () => {
  it('synthesizes on first read and returns the cached blob on repeat', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => audioBlob() })
    vi.stubGlobal('fetch', fetchMock)

    const first = await synthesizeTtsCached([{ text: 'Hello', lang: 'en' }])
    expect(first).toHaveLength(1)
    expect(first[0].size).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = await synthesizeTtsCached([{ text: 'Hello', lang: 'en' }])
    expect(second[0]).toBe(first[0])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('distinguishes segments by text and language', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => audioBlob() })
    vi.stubGlobal('fetch', fetchMock)

    await synthesizeTtsCached([
      { text: 'Hello', lang: 'en' },
      { text: '你好', lang: 'zh' },
      { text: 'Bye', lang: 'en' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await synthesizeTtsCached([{ text: '你好', lang: 'zh' }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns results in input order regardless of completion order', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, blob: async () => new Blob(['slow']) }), 20)),
      )
      .mockImplementationOnce(() => Promise.resolve({ ok: true, blob: async () => new Blob(['fast']) }))
    vi.stubGlobal('fetch', fetchMock)

    const results = await synthesizeTtsCached([
      { text: 'slow', lang: 'en' },
      { text: 'fast', lang: 'en' },
    ])
    expect(await results[0].text()).toBe('slow')
    expect(await results[1].text()).toBe('fast')
  })

  it('sends segment index and text-range metadata in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => audioBlob() })
    vi.stubGlobal('fetch', fetchMock)

    await synthesizeTtsCached([
      { text: '你好世界', lang: 'zh', indexStart: 6, indexEnd: 9 },
      { text: 'Hello', lang: 'en' },
    ])

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstBody).toMatchObject({ text: '你好世界', lang: 'zh', segmentIndex: 0, indexStart: 6, indexEnd: 9 })

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondBody).toMatchObject({ text: 'Hello', lang: 'en', segmentIndex: 1 })
  })

  it('sends a requested voice in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => audioBlob() })
    vi.stubGlobal('fetch', fetchMock)

    await synthesizeTtsCached([{ text: 'Hello', lang: 'en', voice: 'en_GB-alba-medium.onnx' }])

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ text: 'Hello', lang: 'en', voice: 'en_GB-alba-medium.onnx' })
  })

  it('distinguishes the cache by voice', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => audioBlob() })
    vi.stubGlobal('fetch', fetchMock)

    await synthesizeTtsCached([{ text: 'Hello', lang: 'en', voice: 'en_US-lessac-medium.onnx' }])
    await synthesizeTtsCached([{ text: 'Hello', lang: 'en' }])
    await synthesizeTtsCached([{ text: 'Hello', lang: 'en', voice: 'en_GB-alba-medium.onnx' }])
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await synthesizeTtsCached([{ text: 'Hello', lang: 'en', voice: 'en_GB-alba-medium.onnx' }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('synthesizeTtsStreaming', () => {
  it('yields blobs in input order as they complete', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, blob: async () => new Blob(['first']) }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, blob: async () => new Blob(['second']) }))
      .mockImplementationOnce(() => Promise.resolve({ ok: true, blob: async () => new Blob(['third']) }))
    vi.stubGlobal('fetch', fetchMock)

    const results: Blob[] = []
    for await (const blob of synthesizeTtsStreaming([
      { text: 'first', lang: 'en' },
      { text: 'second', lang: 'en' },
      { text: 'third', lang: 'en' },
    ])) {
      results.push(blob)
    }
    expect(await Promise.all(results.map(blob => blob.text()))).toEqual(['first', 'second', 'third'])
  })

  it('yields the first blob before a later one has completed', async () => {
    let releaseSecond: () => void = () => {}
    const second = new Promise<{ ok: boolean; blob: () => Promise<Blob> }>(resolve => {
      releaseSecond = () => resolve({ ok: true, blob: async () => new Blob(['second']) })
    })
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: true, blob: async () => new Blob(['first']) }))
      .mockImplementationOnce(() => second)
    vi.stubGlobal('fetch', fetchMock)

    const iterator = synthesizeTtsStreaming([
      { text: 'first', lang: 'en' },
      { text: 'second', lang: 'en' },
    ])[Symbol.asyncIterator]()

    const first = await iterator.next()
    expect(await first.value!.text()).toBe('first')

    releaseSecond()
    const secondResult = await iterator.next()
    expect(await secondResult.value!.text()).toBe('second')
    expect(await iterator.next()).toEqual({ done: true, value: undefined })
  })

  it('caps in-flight synthesis requests at the given concurrency', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const releases: Array<() => void> = []
    const fetchMock = vi.fn().mockImplementation(() => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise(resolve => {
        releases.push(() => {
          inFlight -= 1
          resolve({ ok: true, blob: async () => new Blob(['audio']) })
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const iterator = synthesizeTtsStreaming(
      [
        { text: 'a', lang: 'en' },
        { text: 'b', lang: 'en' },
        { text: 'c', lang: 'en' },
      ],
      undefined,
      2,
    )[Symbol.asyncIterator]()

    const first = iterator.next()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(maxInFlight).toBe(2)

    releases.splice(0).forEach(release => release())
    await first
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(2)

    releases.splice(0).forEach(release => release())
    await iterator.next()
    await iterator.next()
    expect(await iterator.next()).toEqual({ done: true, value: undefined })
  })
})
