// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPropertiesViewHost from './AdminPropertiesViewHost.svelte'
import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

vi.mock('../LazyCodeEditor.svelte', async () => {
  const { default: Stub } = await import('./LazyCodeEditorStub.svelte')
  return { default: Stub }
})

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

type SettingsState = ReturnType<typeof useAdminSettings>

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
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
}

function renderHost() {
  let state: SettingsState | null = null
  const view = render(AdminPropertiesViewHost, { props: { onReady: s => (state = s) } })
  return {
    ...view,
    getState: () => {
      if (!state) {
        throw new Error('State host did not report ready')
      }
      return state
    },
  }
}

function switchToPropertiesTab(getByText: (text: string) => HTMLElement) {
  fireEvent.click(getByText('Properties'))
}

function switchToFormTab(getByText: (text: string) => HTMLElement) {
  fireEvent.click(getByText('Form'))
}

describe('AdminPropertiesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', makeSettingsFetch())
  })

  it('shows the Form sub-tab and shared Apply/Reload/Reset footer', async () => {
    const { getByText, getByLabelText, getByRole } = renderHost()

    await waitFor(() => expect(getByText('Max documents per IP')).toBeTruthy())
    expect(getByText('Apply')).toBeTruthy()
    expect(getByText('Reload')).toBeTruthy()
    expect(getByText('Reset')).toBeTruthy()
    expect(getByRole('button', { name: 'Form' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'Properties' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('reflects a form edit in the editor text', async () => {
    const { getByText, getByLabelText } = renderHost()
    await waitFor(() => expect(getByText('Max documents per IP')).toBeTruthy())

    fireEvent.input(getByLabelText('Max documents per IP'), { target: { value: '50' } })

    switchToPropertiesTab(getByText)
    const editor = getByLabelText('Settings properties content') as HTMLTextAreaElement
    await waitFor(() => expect(editor.value).toBe('max_documents_per_ip=50\nmax_content_length=1048576'))
  })

  it('reflects an editor edit back in the form', async () => {
    const { getByText, getByLabelText } = renderHost()
    await waitFor(() => expect(getByText('Max documents per IP')).toBeTruthy())

    switchToPropertiesTab(getByText)
    const editor = getByLabelText('Settings properties content') as HTMLTextAreaElement
    await waitFor(() => expect(editor.value).toBe(INITIAL_PROPERTIES))

    fireEvent.input(editor, { target: { value: 'max_documents_per_ip=50\nmax_content_length=2048' } })
    switchToFormTab(getByText)
    await waitFor(() => expect((getByLabelText('Max documents per IP') as HTMLInputElement).value).toBe('50'))
  })

  it('shows a validation banner for unknown settings in the editor', async () => {
    const { getByText, getByLabelText } = renderHost()
    await waitFor(() => expect(getByText('Max documents per IP')).toBeTruthy())

    switchToPropertiesTab(getByText)
    const editor = getByLabelText('Settings properties content') as HTMLTextAreaElement
    fireEvent.input(editor, {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576\nnot_a_setting=5' },
    })

    await waitFor(() => expect(getByText(/Unknown setting: not_a_setting/)).toBeTruthy())
  })

  it('resets both the form and the editor text', async () => {
    const { getByText, getByLabelText } = renderHost()
    await waitFor(() => expect(getByText('Max documents per IP')).toBeTruthy())

    fireEvent.input(getByLabelText('Max documents per IP'), { target: { value: '50' } })
    switchToPropertiesTab(getByText)
    const editor = getByLabelText('Settings properties content') as HTMLTextAreaElement
    await waitFor(() => expect(editor.value).toBe('max_documents_per_ip=50\nmax_content_length=1048576'))

    switchToFormTab(getByText)
    fireEvent.click(getByText('Reset'))
    await waitFor(() => expect((getByLabelText('Max documents per IP') as HTMLInputElement).value).toBe('10'))

    switchToPropertiesTab(getByText)
    await waitFor(() =>
      expect((getByLabelText('Settings properties content') as HTMLTextAreaElement).value).toBe(INITIAL_PROPERTIES),
    )
  })
})
