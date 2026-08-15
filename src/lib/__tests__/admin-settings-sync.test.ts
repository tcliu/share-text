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
    defaultValue: 1024 * 1024,
    envKey: 'MAX_CONTENT_LENGTH',
    min: 1,
    max: 1024 * 1024,
    value: 1024 * 1024,
    source: 'default' as const,
  },
]

const INITIAL_PROPERTIES = 'max_documents_per_ip=10\nmax_content_length=1048576'

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

describe('useAdminSettings properties text sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('initializes the editor text from the loaded settings', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()

    await waitFor(() => expect(state().settings.length).toBe(2))
    expect(state().propertiesText).toBe(INITIAL_PROPERTIES)
  })

  it('pushes a properties edit into the shared draft and preserves the typed text', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()
    await waitFor(() => expect(state().settings.length).toBe(2))

    state().updatePropertiesText('max_documents_per_ip=50\n# comment\nmax_content_length=1048576')
    await waitFor(() => expect(state().draftValues['max_documents_per_ip']).toBe('50'))
    expect(state().draftValues['max_content_length']).toBe('1048576')
    expect(state().propertiesText).toBe('max_documents_per_ip=50\n# comment\nmax_content_length=1048576')
  })

  it('reconciles a form draft edit back into the editor text', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()
    await waitFor(() => expect(state().settings.length).toBe(2))

    state().draftValues['max_content_length'] = '2048'
    await waitFor(() => expect(state().propertiesText).toContain('max_content_length=2048'))
    expect(state().propertiesText).toBe('max_documents_per_ip=10\nmax_content_length=2048')
  })

  it('reports unknown settings in the editor without pushing them', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()
    await waitFor(() => expect(state().settings.length).toBe(2))

    state().updatePropertiesText('max_documents_per_ip=50\nnot_a_setting=5')
    await waitFor(() => expect(state().propertiesProblems).toContain('Unknown setting: not_a_setting'))
    expect(state().draftValues['not_a_setting']).toBeUndefined()
    expect(state().draftValues['max_documents_per_ip']).toBe('50')
  })

  it('reports values that fail a setting rule', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()
    await waitFor(() => expect(state().settings.length).toBe(2))

    state().updatePropertiesText('max_documents_per_ip=abc\nmax_content_length=0')
    await waitFor(() =>
      expect(state().propertiesProblems).toEqual(
        expect.arrayContaining([
          'Max documents per IP must be an integer',
          'Max content length (chars) must be between 1 and 1048576',
        ]),
      ),
    )
  })

  it('resets both the form draft and the editor text', async () => {
    vi.stubGlobal('fetch', makeSettingsFetch())
    const state = renderHost()
    await waitFor(() => expect(state().settings.length).toBe(2))

    state().updatePropertiesText('max_documents_per_ip=50\nmax_content_length=2048')
    await waitFor(() => expect(state().draftValues['max_documents_per_ip']).toBe('50'))

    state().resetDraft()
    await waitFor(() => expect(state().draftValues['max_documents_per_ip']).toBe('10'))
    expect(state().draftValues['max_content_length']).toBe('1048576')
    expect(state().propertiesText).toBe(INITIAL_PROPERTIES)
  })
})
