import { beforeEach, describe, expect, it, vi } from 'vitest'

const userConfigMocks = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  saveUserPreferences: vi.fn(),
}))

vi.mock('$lib/server/user-config', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/user-config')>('$lib/server/user-config')
  return {
    ...actual,
    getUserPreferences: userConfigMocks.getUserPreferences,
    saveUserPreferences: userConfigMocks.saveUserPreferences,
  }
})

const viewerMocks = vi.hoisted(() => ({ resolveViewer: vi.fn() }))

vi.mock('$lib/server/viewer', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/viewer')>('$lib/server/viewer')
  return {
    ...actual,
    resolveViewer: viewerMocks.resolveViewer,
  }
})

const loggingMocks = vi.hoisted(() => ({ logAccess: vi.fn() }))

vi.mock('$lib/server/logging', () => ({ logAccess: loggingMocks.logAccess }))

import { GET, PUT } from '../+server'
import { normalizePreferencesInput } from '$lib/server/user-config'

function userViewer() {
  return { type: 'user' as const, userId: 1, username: 'alice', ip: '127.0.0.1', name: 'alice' }
}

function anonymousViewer() {
  return { type: 'anonymous' as const, userId: null, username: null, ip: '127.0.0.1', name: '127.0.0.1' }
}

type EventLike = {
  getClientAddress: () => string
  cookies: { get: () => null }
}

const baseEvent = (): EventLike => ({
  getClientAddress: () => '127.0.0.1',
  cookies: { get: () => null },
})

describe('GET /api/user/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())
    userConfigMocks.getUserPreferences.mockResolvedValue({ preferredLanguage: 'en', ttsVoices: {} })
  })

  it('requires a signed-in user', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(anonymousViewer())

    const response = await GET(baseEvent() as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(userConfigMocks.getUserPreferences).not.toHaveBeenCalled()
  })

  it('returns the saved preferences for a signed-in user', async () => {
    userConfigMocks.getUserPreferences.mockResolvedValue({
      preferredLanguage: 'zh-CN',
      ttsVoices: { en: 'en_US-lessac-medium.onnx' },
    })

    const response = await GET(baseEvent() as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      preferredLanguage: 'zh-CN',
      ttsVoices: { en: 'en_US-lessac-medium.onnx' },
    })
    expect(userConfigMocks.getUserPreferences).toHaveBeenCalledWith(userViewer())
  })
})

describe('PUT /api/user/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    viewerMocks.resolveViewer.mockResolvedValue(userViewer())
  })

  it('requires a signed-in user', async () => {
    viewerMocks.resolveViewer.mockResolvedValue(anonymousViewer())

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: 'en', ttsVoices: {} }),
      }),
    } as never)

    expect(response.status).toBe(401)
    expect(userConfigMocks.saveUserPreferences).not.toHaveBeenCalled()
  })

  it('rejects an invalid preferredLanguage', async () => {
    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: 'de', ttsVoices: {} }),
      }),
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid preferredLanguage' })
    expect(userConfigMocks.saveUserPreferences).not.toHaveBeenCalled()
  })

  it('rejects an invalid ttsVoices shape', async () => {
    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: 'en', ttsVoices: { en: 42 } }),
      }),
    } as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid ttsVoices' })
    expect(userConfigMocks.saveUserPreferences).not.toHaveBeenCalled()
  })

  it('saves valid preferences and logs the mutation', async () => {
    const preferences = { preferredLanguage: 'zh-TW', ttsVoices: { zh: 'zh_CN-huayan-medium.onnx' } }
    userConfigMocks.saveUserPreferences.mockResolvedValue(preferences)

    const response = await PUT({
      ...baseEvent(),
      request: new Request('http://localhost/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      }),
    } as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(preferences)
    expect(userConfigMocks.saveUserPreferences).toHaveBeenCalledWith(userViewer(), preferences)
    expect(loggingMocks.logAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_preferences_save',
        details: expect.objectContaining({
          user: 'alice',
          user_id: 1,
          preferred_language: 'zh-TW',
          tts_voice_langs: 'zh',
        }),
      }),
    )
  })
})

describe('normalizePreferencesInput', () => {
  it('normalizes empty or null voices to an empty record', () => {
    expect(normalizePreferencesInput({ preferredLanguage: 'en', ttsVoices: null })).toEqual({
      preferredLanguage: 'en',
      ttsVoices: {},
    })
    expect(normalizePreferencesInput({ preferredLanguage: 'en' })).toEqual({
      preferredLanguage: 'en',
      ttsVoices: {},
    })
  })

  it('drops empty-string voices instead of keeping them', () => {
    expect(
      normalizePreferencesInput({
        preferredLanguage: 'en',
        ttsVoices: { en: 'en_US-lessac-medium.onnx', zh: '' },
      }),
    ).toEqual({
      preferredLanguage: 'en',
      ttsVoices: { en: 'en_US-lessac-medium.onnx' },
    })
  })
})
