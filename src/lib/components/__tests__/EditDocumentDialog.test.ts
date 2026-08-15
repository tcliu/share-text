// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import EditDocumentDialog from '../EditDocumentDialog.svelte'

vi.mock('../LazyCodeEditor.svelte', async () => {
  const { default: Stub } = await import('./LazyCodeEditorStub.svelte')
  return { default: Stub }
})

const document = {
  id: 'a1b2c3',
  name: 'Notes',
  documentType: 'markdown',
  tags: [],
  createdBy: '10.0.0.1',
  updatedBy: '10.0.0.2',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  contentSize: 11,
  isPublic: true,
}

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(EditDocumentDialog, {
    props: {
      document,
      content: '# hello',
      contentLoading: false,
      pending: false,
      onSave: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    },
  })
}

describe('EditDocumentDialog', () => {
  it('renders the header fields from the document on the details tab', () => {
    const { getByLabelText } = renderDialog()

    expect((getByLabelText('Key') as HTMLInputElement).value).toBe('a1b2c3')
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Notes')
    expect((getByLabelText('Created by') as HTMLInputElement).value).toBe('10.0.0.1')
    expect((getByLabelText('Updated by') as HTMLInputElement).value).toBe('10.0.0.2')
    expect((getByLabelText('Document type') as HTMLInputElement).value).toBe('Markdown')
  })

  it('keeps OK disabled until a field changes', () => {
    const { getByText, getByLabelText } = renderDialog()

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('saves the edited header fields, type, and content', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText, getByRole } = renderDialog({ onSave })

    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(getByRole('button', { name: 'Content' }))
    const editor = getByLabelText('Document content') as HTMLTextAreaElement
    fireEvent.input(editor, { target: { value: '# renamed' } })
    fireEvent.click(getByText('OK'))

    expect(onSave).toHaveBeenCalledWith({
      key: 'a1b2c3',
      name: 'Renamed',
      createdBy: '10.0.0.1',
      updatedBy: '10.0.0.2',
      documentType: 'markdown',
      content: '# renamed',
    })
  })

  it('sends a changed document type on save', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText, getByRole } = renderDialog({ onSave })

    fireEvent.focus(getByLabelText('Document type'))
    fireEvent.click(getByRole('option', { name: 'JSON' }))
    fireEvent.click(getByText('OK'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'json' }))
  })

  it('add mode creates a document with name, type, and content', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText, getByRole } = render(EditDocumentDialog, {
      props: {
        mode: 'add',
        document: null,
        content: '',
        contentLoading: false,
        pending: false,
        onSave,
        onClose: vi.fn(),
      },
    })

    fireEvent.input(getByLabelText('Name'), { target: { value: 'New doc' } })
    fireEvent.click(getByRole('button', { name: 'Content' }))
    fireEvent.input(getByLabelText('Document content'), { target: { value: 'body' } })
    fireEvent.click(getByText('Create'))

    expect(onSave).toHaveBeenCalledWith({ name: 'New doc', documentType: 'text', content: 'body' })
  })

  it('shows the content editor on the content tab with the loaded content', () => {
    const { getByRole, getByLabelText } = renderDialog()

    fireEvent.click(getByRole('button', { name: 'Content' }))

    expect((getByLabelText('Document content') as HTMLTextAreaElement).value).toBe('# hello')
  })

  it('treats content edits as dirty and sends them on save', () => {
    const onSave = vi.fn()
    const { getByText, getByRole, getByLabelText } = renderDialog({ onSave })

    fireEvent.click(getByRole('button', { name: 'Content' }))
    const editor = getByLabelText('Document content') as HTMLTextAreaElement
    fireEvent.input(editor, { target: { value: '# changed' } })

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('OK'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '# changed' }))
  })

  it('disables OK while content is still loading', () => {
    const { getByText, getByRole } = renderDialog({ contentLoading: true })

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Content' }))
    expect(getByText('Loading content...')).toBeTruthy()
  })

  it('resets edits back to the document snapshot', () => {
    const { getByText, getByRole, getByLabelText } = renderDialog()

    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.click(getByRole('button', { name: 'Content' }))
    fireEvent.input(getByLabelText('Document content'), { target: { value: '# changed' } })
    fireEvent.click(getByText('Reset'))
    fireEvent.click(getByRole('button', { name: 'Details' }))

    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Notes')
    fireEvent.click(getByRole('button', { name: 'Content' }))
    expect((getByLabelText('Document content') as HTMLTextAreaElement).value).toBe('# hello')
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})
