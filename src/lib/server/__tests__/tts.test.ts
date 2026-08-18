// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/server/settings', () => ({
  getSettingStringValue: vi.fn(),
}))

import { getSettingStringValue } from '$lib/server/settings'
import { clearTtsLanguageCache, getSupportedTtsLanguages } from '$lib/server/tts'

const mockGetSettingStringValue = vi.mocked(getSettingStringValue)

beforeEach(() => {
  vi.unstubAllGlobals()
  clearTtsLanguageCache()
  mockGetSettingStringValue.mockReset()
})

describe('getSupportedTtsLanguages', () => {
  it('returns the fallback set when the service url is empty', async () => {
    mockGetSettingStringValue.mockResolvedValue('')

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja'])
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

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja'])
  })

  it('uses the default set when the backend responds with a non-ok status', async () => {
    mockGetSettingStringValue.mockResolvedValue('http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSupportedTtsLanguages()).toEqual(['en', 'en_gb', 'zh', 'ja'])
  })
})
