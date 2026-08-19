// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ttsMocks = vi.hoisted(() => ({
  isTtsConfigured: vi.fn(),
  getSupportedTtsLanguages: vi.fn(),
  getSupportedTtsVoices: vi.fn(),
}))
const settingsMocks = vi.hoisted(() => ({
  getSettingValue: vi.fn(),
}))

vi.mock('$lib/server/tts', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/tts')>('$lib/server/tts')
  return {
    ...actual,
    isTtsConfigured: ttsMocks.isTtsConfigured,
    getSupportedTtsLanguages: ttsMocks.getSupportedTtsLanguages,
    getSupportedTtsVoices: ttsMocks.getSupportedTtsVoices,
  }
})

vi.mock('$lib/server/settings', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/settings')>('$lib/server/settings')
  return {
    ...actual,
    getSettingValue: settingsMocks.getSettingValue,
  }
})

import { GET } from '../+server'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/tts/capabilities', () => {
  it('returns the runtime settings even when the feature is unconfigured', async () => {
    ttsMocks.isTtsConfigured.mockResolvedValue(false)
    settingsMocks.getSettingValue.mockImplementation(async (key: string) =>
      key === 'tts_max_segment_length' ? 300 : 2,
    )

    const response = await GET({} as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      configured: false,
      languages: [],
      voices: {},
      maxSegmentLength: 300,
      synthesisConcurrency: 2,
    })
  })

  it('includes the settings alongside the configured languages', async () => {
    ttsMocks.isTtsConfigured.mockResolvedValue(true)
    ttsMocks.getSupportedTtsLanguages.mockResolvedValue(['en', 'zh'])
    ttsMocks.getSupportedTtsVoices.mockResolvedValue({
      en: ['en_US-lessac-medium.onnx'],
      zh: ['zh_CN-huayan-medium.onnx'],
    })
    settingsMocks.getSettingValue.mockImplementation(async (key: string) =>
      key === 'tts_max_segment_length' ? 400 : 3,
    )

    const response = await GET({} as never)

    await expect(response.json()).resolves.toEqual({
      configured: true,
      languages: ['en', 'zh'],
      voices: {
        en: ['en_US-lessac-medium.onnx'],
        zh: ['zh_CN-huayan-medium.onnx'],
      },
      maxSegmentLength: 400,
      synthesisConcurrency: 3,
    })
  })
})
