// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ttsMocks = vi.hoisted(() => ({
  isTtsConfigured: vi.fn(),
  getSupportedTtsLanguages: vi.fn(),
  getTtsServiceUrl: vi.fn(),
}))

vi.mock('$lib/server/tts', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/tts')>('$lib/server/tts')
  return {
    ...actual,
    isTtsConfigured: ttsMocks.isTtsConfigured,
    getSupportedTtsLanguages: ttsMocks.getSupportedTtsLanguages,
    getTtsServiceUrl: ttsMocks.getTtsServiceUrl,
  }
})

import { POST } from '../+server'

function post(body: unknown) {
  return POST({ request: new Request('http://localhost/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  ttsMocks.isTtsConfigured.mockResolvedValue(true)
  ttsMocks.getSupportedTtsLanguages.mockResolvedValue(['en', 'zh'])
  ttsMocks.getTtsServiceUrl.mockResolvedValue('http://tts-service')
})

describe('POST /api/tts/synthesize', () => {
  it('forwards segment meta to the backend as snake_case fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: new ReadableStream(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await post({ text: '你好世界', lang: 'zh', segmentIndex: 0, indexStart: 6, indexEnd: 9 })

    expect(response.status).toBe(200)
    const sent = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(sent[0]).toBe('http://tts-service/api/synthesize')
    expect(JSON.parse(String(sent[1].body))).toEqual({
      text: '你好世界',
      lang: 'zh',
      segment_index: 0,
      index_start: 6,
      index_end: 9,
    })
  })

  it('omits segment meta when the client did not provide it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: new ReadableStream(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await post({ text: 'Hello', lang: 'en' })

    expect(response.status).toBe(200)
    const sent = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(sent[1].body))).toEqual({ text: 'Hello', lang: 'en' })
  })

  it('forwards a requested voice to the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: new ReadableStream(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await post({ text: 'Hello', lang: 'en', voice: 'en_GB-alba-medium.onnx' })

    expect(response.status).toBe(200)
    const sent = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(sent[1].body))).toEqual({
      text: 'Hello',
      lang: 'en',
      voice: 'en_GB-alba-medium.onnx',
    })
  })

  it('omits an empty voice', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: new ReadableStream(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await post({ text: 'Hello', lang: 'en', voice: '' })

    expect(response.status).toBe(200)
    const sent = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(sent[1].body))).toEqual({ text: 'Hello', lang: 'en' })
  })
})
