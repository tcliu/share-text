// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import AdminSettingsBatchDialog from '../AdminSettingsBatchDialog.svelte'
import type { AdminSetting } from '$lib/admin'
import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

vi.mock('../LazyCodeEditor.svelte', async () => {
  const { default: Stub } = await import('./LazyCodeEditorStub.svelte')
  return { default: Stub }
})

type SettingsState = ReturnType<typeof useAdminSettings>

const settings: AdminSetting[] = [
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
    source: 'default',
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
    source: 'default',
  },
]

function renderDialog(overrides: { closeBatch?: ReturnType<typeof vi.fn>; submitBatch?: ReturnType<typeof vi.fn> } = {}) {
  const closeBatch = overrides.closeBatch ?? vi.fn()
  const submitBatch = overrides.submitBatch ?? vi.fn()
  const settingsState = {
    settings,
    batchPending: false,
    closeBatch,
    submitBatch,
  } as unknown as SettingsState
  const rendered = render(AdminSettingsBatchDialog, { props: { settingsState } })
  return { ...rendered, closeBatch, submitBatch }
}

describe('AdminSettingsBatchDialog', () => {
  it('pre-fills the editor with current values and keeps Apply disabled', () => {
    const { getByLabelText, getByText } = renderDialog()

    expect((getByLabelText('Settings properties content') as HTMLTextAreaElement).value).toBe(
      'max_documents_per_ip=10\nmax_content_length=1048576',
    )
    expect((getByText('Apply').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Apply and Reset after an edit', () => {
    const { getByLabelText, getByText } = renderDialog()

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })

    expect((getByText('Apply').closest('button') as HTMLButtonElement).disabled).toBe(false)
    expect((getByText('Reset').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('submits the edited content on Apply', () => {
    const submitBatch = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ submitBatch })

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })
    fireEvent.click(getByText('Apply'))

    expect(submitBatch).toHaveBeenCalledWith('max_documents_per_ip=50\nmax_content_length=1048576')
  })

  it('restores the current values on Reset', () => {
    const { getByLabelText, getByText } = renderDialog()

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })
    fireEvent.click(getByText('Reset'))

    expect((getByLabelText('Settings properties content') as HTMLTextAreaElement).value).toBe(
      'max_documents_per_ip=10\nmax_content_length=1048576',
    )
    expect((getByText('Apply').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes immediately when dismissed without changes', () => {
    const closeBatch = vi.fn()
    const { getByLabelText, queryByText } = renderDialog({ closeBatch })

    fireEvent.click(getByLabelText('Close dialog'))

    expect(closeBatch).toHaveBeenCalled()
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })

  it('prompts to discard when dismissed with unsaved changes', () => {
    const closeBatch = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ closeBatch })

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })
    fireEvent.click(getByLabelText('Close dialog'))

    expect(getByText('Discard unsaved changes?')).toBeTruthy()
    expect(closeBatch).not.toHaveBeenCalled()
  })

  it('closes after confirming the discard', () => {
    const closeBatch = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ closeBatch })

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })
    fireEvent.click(getByLabelText('Close dialog'))
    fireEvent.click(getByText('Discard'))

    expect(closeBatch).toHaveBeenCalled()
  })

  it('returns to the form when cancelling the discard confirm', () => {
    const closeBatch = vi.fn()
    const { getAllByLabelText, getByLabelText, queryByText } = renderDialog({ closeBatch })

    fireEvent.input(getByLabelText('Settings properties content'), {
      target: { value: 'max_documents_per_ip=50\nmax_content_length=1048576' },
    })
    fireEvent.click(getByLabelText('Close dialog'))

    const closeButtons = getAllByLabelText('Close dialog')
    fireEvent.click(closeButtons[closeButtons.length - 1])

    expect(closeBatch).not.toHaveBeenCalled()
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })
})
