// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSettingsStateHost from './AdminSettingsStateHost.svelte'
import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

type AdminSettingsState = ReturnType<typeof useAdminSettings>

const settings = [
  {
    key: 'max_documents_per_ip',
    label: 'Max documents per IP',
    description: 'Maximum number of documents a single client IP can create.',
    kind: 'number',
    defaultValue: 10,
    envKey: 'MAX_DOCUMENTS_PER_IP',
    min: 1,
    max: 1000,
    value: 10,
    source: 'default' as const,
  },
  {
    key: 'max_content_length',
    label: 'Max content length (chars)',
    description: 'Maximum number of characters allowed in document content.',
    kind: 'number',
    defaultValue: 1024 * 1024,
    envKey: 'MAX_CONTENT_LENGTH',
    min: 1,
    max: 1024 * 1024,
    value: 1024 * 1024,
    source: 'default' as const,
  },
  {
    key: 'tts_service_url',
    label: 'TTS service URL',
    description: 'Base URL of the text-to-speech service.',
    kind: 'string',
    defaultValue: '',
    envKey: 'TTS_SERVICE_URL',
    value: 'http://127.0.0.1:8000',
    source: 'environment' as const,
  },
]

function makeSettingsFetch() {
  const settingsFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/api/admin/settings')) {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { settings: Array<{ key: string; value: number | null }> }
        const updated = settings.map(setting => {
          const change = body.settings.find(item => item.key === setting.key)
          return change ? { ...setting, value: change.value ?? setting.value, source: 'database' as const } : setting
        })
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ settings: updated }) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ settings }) })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
  })
  return settingsFetch
}

function renderHost() {
  let state: AdminSettingsState | null = null
  render(AdminSettingsStateHost, { props: { onReady: s => (state = s) } })
  return () => {
    const current = state
    if (!current) {
      throw new Error('State host did not report ready')
    }
    return current
  }
}

describe('useAdminSettings batch update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens and closes the batch dialog', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    expect(state().batchOpen).toBe(false)

    state().openBatch()
    expect(state().batchOpen).toBe(true)

    state().closeBatch()
    expect(state().batchOpen).toBe(false)
  })

  it('submits only the changed settings and closes the dialog on success', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=50\nmax_content_length=1048576')

    const putCalls = settingsFetch.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(putCalls).toHaveLength(1)
    expect(JSON.parse(String(putCalls[0][1]?.body))).toEqual({
      settings: [{ key: 'max_documents_per_ip', value: 50 }],
    })
    expect(state().batchOpen).toBe(false)
    expect(state().settings.find(item => item.key === 'max_documents_per_ip')).toMatchObject({
      value: 50,
      source: 'database',
    })
  })

  it('rejects an unknown setting key without calling the API', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('not_a_setting=5')

    expect(settingsFetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(state().batchOpen).toBe(true)
  })

  it('rejects a non-integer value for a numeric setting', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=abc')

    expect(settingsFetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(state().batchOpen).toBe(true)
  })

  it('rejects a value outside the setting range', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=0')

    expect(settingsFetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(state().batchOpen).toBe(true)
  })

  it('reports when no values changed', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=10\nmax_content_length=1048576')

    expect(settingsFetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(state().batchOpen).toBe(true)
  })

  it('applies string settings alongside numeric settings in one batch', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=50\nmax_content_length=1048576\ntts_service_url=http://tts.internal:9000')

    const putCalls = settingsFetch.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(putCalls).toHaveLength(1)
    expect(JSON.parse(String(putCalls[0][1]?.body))).toEqual({
      settings: [
        { key: 'max_documents_per_ip', value: 50 },
        { key: 'tts_service_url', value: 'http://tts.internal:9000' },
      ],
    })
    expect(state().batchOpen).toBe(false)
    expect(state().settings.find(item => item.key === 'tts_service_url')).toMatchObject({
      value: 'http://tts.internal:9000',
      source: 'database',
    })
  })

  it('rejects the whole batch when any numeric value is invalid, even if string settings are fine', async () => {
    const settingsFetch = makeSettingsFetch()
    vi.stubGlobal('fetch', settingsFetch)
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(3))
    state().openBatch()
    await state().submitBatch('max_documents_per_ip=abc\ntts_service_url=http://tts.internal:9000')

    expect(settingsFetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    expect(state().batchOpen).toBe(true)
  })
})
