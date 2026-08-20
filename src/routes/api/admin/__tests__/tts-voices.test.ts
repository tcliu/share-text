// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TtsServiceError } from '$lib/server/tts'

const ttsMocks = vi.hoisted(() => ({
  getAdminTtsVoicesState: vi.fn(),
  saveAdminTtsDefaultVoices: vi.fn(),
  uploadAdminTtsVoice: vi.fn(),
  deleteAdminTtsVoice: vi.fn(),
}))

vi.mock('$lib/server/tts', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/tts')>('$lib/server/tts')
  return {
    ...actual,
    getAdminTtsVoicesState: ttsMocks.getAdminTtsVoicesState,
    saveAdminTtsDefaultVoices: ttsMocks.saveAdminTtsDefaultVoices,
    uploadAdminTtsVoice: ttsMocks.uploadAdminTtsVoice,
    deleteAdminTtsVoice: ttsMocks.deleteAdminTtsVoice,
  }
})

vi.mock('$lib/server/logging', () => ({ logEvent: vi.fn() }))

import { DELETE, GET, POST, PUT } from '../tts/voices/+server'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/tts/voices', () => {
  it('returns the proxied backend voice state', async () => {
    ttsMocks.getAdminTtsVoicesState.mockResolvedValue({
      configured: true,
      languages: ['en'],
      voices: { en: ['a.onnx'] },
      defaultVoices: { en: 'a.onnx' },
    })

    const response = await GET({} as never)

    await expect(response.json()).resolves.toEqual({
      configured: true,
      languages: ['en'],
      voices: { en: ['a.onnx'] },
      defaultVoices: { en: 'a.onnx' },
    })
  })
})

describe('PUT /api/admin/tts/voices', () => {
  it('normalizes and forwards default voices', async () => {
    ttsMocks.saveAdminTtsDefaultVoices.mockResolvedValue({
      configured: true,
      languages: ['en'],
      voices: { en: ['a.onnx'] },
      defaultVoices: { en: 'a.onnx' },
    })

    const response = await PUT({
      request: new Request('http://localhost/api/admin/tts/voices', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultVoices: { en: '  a.onnx  ', zh: '' } }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(ttsMocks.saveAdminTtsDefaultVoices).toHaveBeenCalledWith({ en: 'a.onnx', zh: null })
    expect(response.status).toBe(200)
  })

  it('preserves user-correctable backend validation errors', async () => {
    ttsMocks.saveAdminTtsDefaultVoices.mockRejectedValue(new TtsServiceError('Unknown voice', 422))

    const response = await PUT({
      request: new Request('http://localhost/api/admin/tts/voices', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultVoices: { en: 'missing.onnx' } }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown voice' })
  })
})

describe('DELETE /api/admin/tts/voices', () => {
  it('requires lang and voice query params', async () => {
    const response = await DELETE({
      url: new URL('http://localhost/api/admin/tts/voices?lang=en'),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(response.status).toBe(400)
  })
})

describe('POST /api/admin/tts/voices', () => {
  it('forwards the upload form data', async () => {
    ttsMocks.uploadAdminTtsVoice.mockResolvedValue({
      configured: true,
      languages: ['en'],
      voices: { en: ['a.onnx'] },
      defaultVoices: {},
    })
    const formData = new FormData()
    formData.set('lang', 'en')
    formData.set('model', new File(['model'], 'a.onnx'))
    formData.set('config', new File(['config'], 'a.onnx.json'))

    const response = await POST({
      request: new Request('http://localhost/api/admin/tts/voices', { method: 'POST', body: formData }),
      getClientAddress: () => '127.0.0.1',
    } as never)

    expect(ttsMocks.uploadAdminTtsVoice).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })
})
