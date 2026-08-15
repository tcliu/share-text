// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ImportDialog from '../ImportDialog.svelte'

vi.mock('../LazyCodeEditor.svelte', async () => {
  const { default: Stub } = await import('./LazyCodeEditorStub.svelte')
  return { default: Stub }
})

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(ImportDialog, {
    props: {
      kind: 'documents',
      pending: false,
      onImport: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    },
  })
}

describe('ImportDialog', () => {
  it('renders the JSON editor and the upload, samples, OK, and Reset controls', () => {
    const { getByLabelText, getByText } = renderDialog()

    expect(getByLabelText('JSON import content')).toBeTruthy()
    expect(getByLabelText('Upload a JSON file')).toBeTruthy()
    expect(getByLabelText('Show import samples')).toBeTruthy()
    expect(getByText('OK')).toBeTruthy()
    expect(getByText('Reset')).toBeTruthy()
  })

  it('imports a single JSON object', () => {
    const onImport = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onImport })

    fireEvent.input(getByLabelText('JSON import content'), {
      target: { value: '{"name":"Notes","content":"hello"}' },
    })
    fireEvent.click(getByText('OK'))

    expect(onImport).toHaveBeenCalledWith([{ name: 'Notes', content: 'hello' }])
  })

  it('imports a JSON array of records', () => {
    const onImport = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onImport })

    fireEvent.input(getByLabelText('JSON import content'), { target: { value: '[{"name":"A"},{"name":"B"}]' } })
    fireEvent.click(getByText('OK'))

    expect(onImport).toHaveBeenCalledWith([{ name: 'A' }, { name: 'B' }])
  })

  it('does not import invalid JSON', () => {
    const onImport = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onImport })

    fireEvent.input(getByLabelText('JSON import content'), { target: { value: '{not json' } })
    fireEvent.click(getByText('OK'))

    expect(onImport).not.toHaveBeenCalled()
  })

  it('does not import a scalar JSON value', () => {
    const onImport = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onImport })

    fireEvent.input(getByLabelText('JSON import content'), { target: { value: '"just a string"' } })
    fireEvent.click(getByText('OK'))

    expect(onImport).not.toHaveBeenCalled()
  })

  it('clears the editor on Reset', () => {
    const { getByLabelText, getByText } = renderDialog()

    fireEvent.input(getByLabelText('JSON import content'), { target: { value: '{"name":"A"}' } })
    fireEvent.click(getByText('Reset'))

    expect((getByLabelText('JSON import content') as HTMLTextAreaElement).value).toBe('')
  })

  it('loads an uploaded file into the editor', async () => {
    const { getByLabelText } = renderDialog()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['{"name":"A","content":"hello"}'], 'docs.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })

    fireEvent.change(input)

    await waitFor(() => {
      expect((getByLabelText('JSON import content') as HTMLTextAreaElement).value).toBe(
        '{"name":"A","content":"hello"}',
      )
    })
  })

  it('shows a users-oriented title in users mode', () => {
    const { getByText } = renderDialog({ kind: 'users' })

    expect(getByText('Import Users')).toBeTruthy()
  })

  it('opens a samples dialog with tabbed document samples', async () => {
    const { getByLabelText, getByText, getByRole, queryByText } = renderDialog()

    expect(queryByText('Import samples')).toBeNull()
    fireEvent.click(getByLabelText('Show import samples'))

    expect(getByText('Import samples')).toBeTruthy()
    expect(getByLabelText('Copy Single document sample')).toBeTruthy()
    expect(getByText(/"Meeting notes"/)).toBeTruthy()

    fireEvent.click(getByRole('button', { name: 'Multiple' }))
    expect(getByLabelText('Copy Multiple documents sample')).toBeTruthy()
    expect(getByText(/"Report"/)).toBeTruthy()
  })

  it('shows user samples in users mode', () => {
    const { getByLabelText, getByRole } = renderDialog({ kind: 'users' })

    fireEvent.click(getByLabelText('Show import samples'))

    expect(getByLabelText('Copy Single user sample')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Multiple' }))
    expect(getByLabelText('Copy Multiple users sample')).toBeTruthy()
  })

  it('copies a sample to the clipboard', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const { getByLabelText } = renderDialog()

    fireEvent.click(getByLabelText('Show import samples'))
    fireEvent.click(getByLabelText('Copy Single document sample'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('"name": "Meeting notes"'))
    })
  })
})
