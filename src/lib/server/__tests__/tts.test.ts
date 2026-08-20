// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/settings', () => ({
  getSettingStringValue: vi.fn(),
}))

import { getSettingStringValue } from '$lib/server/settings'
import { clearTtsLanguageCache, getSupportedTtsLanguages, getSupportedTtsVoices } from '$lib/server/tts'

const mockGetSettingStringValue = vi.mocked(getSettingStringValue)

beforeEach(() => {
  vi.unstubAllGlobals()
  clearTtsLanguageCache()
  mockGetSettingStringValue.mockReset()
})

describe('getSupportedTtsLanguages', () => {
  it('returns the fallback set when the service url is empty', async () => {
    mockGetSettingStringValue.mockResolvedValue('')

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja', 'yue'])
  })

  it('returns the backend languages and caches them', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ languages: ['en', 'zh'] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'zh'])
    expect(await getSupportedTtsLanguages()).toEqual(['en', 'zh'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the default set when the backend is unreachable', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockRejectedValue(new Error('unreachable'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja', 'yue'])
  })

  it('uses the default set when the backend responds with a non-ok status', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja', 'yue'])
  })
})

describe('getSupportedTtsVoices', () => {
  it('returns an empty map when the service url is empty', async () => {
    mockGetSettingStringValue.mockResolvedValue('')

    expect(await getSupportedTtsVoices()).toEqual({})
  })

  it('returns the backend voices per language and caches them', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        languages: ['en', 'zh'],
        voices: {
          en: ['en_US-lessac-medium.onnx'],
          zh: [],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSupportedTtsVoices()).toEqual({
      en: ['en_US-lessac-medium.onnx'],
      zh: [],
    })
    expect(await getSupportedTtsVoices()).toEqual({
      en: ['en_US-lessac-medium.onnx'],
      zh: [],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('filters out non-string and non-array voice entries', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          languages: ['en'],
          voices: { en: ['a.onnx', 42], zh: 'bogus' },
        }),
      }),
    )

    expect(await getSupportedTtsVoices()).toEqual({ en: ['a.onnx'] })
  })

  it('falls back to an empty map when the backend is unreachable', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')))

    expect(await getSupportedTtsVoices()).toEqual({})
  })
})
