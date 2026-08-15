// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSynthesisCache, synthesizeTtsCached } from '../tts-client'

function audioBlob() {
  return new Blob(['audio-data'])
}

beforeEach(() => {
  vi.unstubAllGlobals()
  clearSynthesisCache()
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
})
