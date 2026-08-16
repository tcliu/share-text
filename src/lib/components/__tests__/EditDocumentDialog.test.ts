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
  it('renders the header fields from the document on the details pane', () => {
    const { getByLabelText } = renderDialog()

    expect((getByLabelText('Key') as HTMLInputElement).value).toBe('a1b2c3')
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Notes')
    expect((getByLabelText('Created by') as HTMLInputElement).value).toBe('10.0.0.1')
    expect((getByLabelText('Updated by') as HTMLInputElement).value).toBe('10.0.0.2')
    expect((getByLabelText('Document type') as HTMLInputElement).value).toBe('Markdown')
  })

  it('renders the details pane and content editor together without tabs', () => {
    const { getByLabelText, getByText, queryByText } = renderDialog()

    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Notes')
    expect((getByLabelText('Document content') as HTMLTextAreaElement).value).toBe('# hello')
    expect(queryByText('Details')).toBeNull()
    expect(getByText('Content')).toBeTruthy()
  })

  it('keeps OK disabled until a field changes', () => {
    const { getByText, getByLabelText } = renderDialog()

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('saves the edited header fields, type, and content', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText } = renderDialog({ onSave })

    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    const editor = getByLabelText('Document content') as HTMLTextAreaElement
    fireEvent.input(editor, { target: { value: '# renamed' } })
    fireEvent.click(getByText('OK'))

    expect(onSave).toHaveBeenCalledWith({
      key: 'a1b2c3',
      name: 'Renamed',
      createdBy: '10.0.0.1',
      updatedBy: '10.0.0.2',
      documentType: 'markdown',
      isPublic: true,
      content: '# renamed',
      sharedWith: [],
    })
  })

  it('toggles visibility and saves the change', () => {
    const onSave = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onSave })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('OK'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }))
  })

  it('reset restores the original visibility', () => {
    const { getByLabelText, getByText } = renderDialog({ onSave: vi.fn() })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getByText('Reset'))
    expect((getByLabelText('Anyone with the link can view') as HTMLInputElement).checked).toBe(true)
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
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
    const { getByText, getByLabelText } = render(EditDocumentDialog, {
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
    fireEvent.input(getByLabelText('Document content'), { target: { value: 'body' } })
    fireEvent.click(getByText('Create'))

    expect(onSave).toHaveBeenCalledWith({ name: 'New doc', documentType: 'text', content: 'body' })
  })

  it('shows the content editor with the loaded content', () => {
    const { getByLabelText } = renderDialog()

    expect((getByLabelText('Document content') as HTMLTextAreaElement).value).toBe('# hello')
  })

  it('treats content edits as dirty and sends them on save', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText } = renderDialog({ onSave })

    const editor = getByLabelText('Document content') as HTMLTextAreaElement
    fireEvent.input(editor, { target: { value: '# changed' } })

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('OK'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '# changed' }))
  })

  it('disables OK while content is still loading', () => {
    const { getByText } = renderDialog({ contentLoading: true })

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(getByText('Loading content...')).toBeTruthy()
  })

  it('keeps OK disabled and shows an error when the content fetch failed', () => {
    const { getByText, queryByText } = renderDialog({ contentFailed: true, sharedWith: [] })

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(getByText('Failed to load content. Close and try again.')).toBeTruthy()
    expect(getByText('Failed to load share list.')).toBeTruthy()
    expect(queryByText('Add by username or email')).toBeNull()
  })

  it('shows the shared-with list in edit mode', () => {
    const { getByText } = renderDialog({
      sharedWith: [
        { id: 1, username: 'alice', email: 'alice@example.com', status: 'active' },
        { id: 2, username: 'bob', email: 'bob@example.com', status: 'inactive' },
      ],
    })

    expect(getByText('alice')).toBeTruthy()
    expect(getByText('bob')).toBeTruthy()
  })

  it('renders an empty combobox when the document has no sharees', () => {
    const { getByPlaceholderText } = renderDialog({ sharedWith: [] })

    expect(getByPlaceholderText('Add by username or email')).toBeTruthy()
  })

  it('shows a loading state for shared-with info while content loads', () => {
    const { getByText } = renderDialog({ sharedWith: [], contentLoading: true })

    expect(getByText('Loading…')).toBeTruthy()
  })

  it('does not show shared-with info in add mode', () => {
    const { queryByText } = render(EditDocumentDialog, {
      props: {
        mode: 'add',
        document: null,
        content: '',
        contentLoading: false,
        pending: false,
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    })

    expect(queryByText('Shared with')).toBeNull()
  })

  it('adds a sharee by typing and saves the updated list', () => {
    const onSave = vi.fn()
    const { getByText, getByLabelText } = renderDialog({ onSave })

    const combobox = getByLabelText('Shared with') as HTMLInputElement
    fireEvent.input(combobox, { target: { value: 'carol' } })
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(getByText('carol')).toBeTruthy()
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('OK'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sharedWith: ['carol'] }))
  })

  it('removes a sharee and saves the remaining list', () => {
    const onSave = vi.fn()
    const { getByText, getByRole, queryByText } = renderDialog({
      onSave,
      sharedWith: [{ id: 1, username: 'alice', email: 'alice@example.com', status: 'active' }],
    })

    fireEvent.click(getByRole('button', { name: 'Remove alice' }))
    expect(queryByText('alice')).toBeNull()
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(getByText('OK'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sharedWith: [] }))
  })

  it('reset restores the original share list', () => {
    const { getByText, getByRole, queryByText } = renderDialog({
      sharedWith: [{ id: 1, username: 'alice', email: 'alice@example.com', status: 'active' }],
    })

    fireEvent.click(getByRole('button', { name: 'Remove alice' }))
    expect(queryByText('alice')).toBeNull()
    fireEvent.click(getByText('Reset'))
    expect(getByText('alice')).toBeTruthy()
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('resets edits back to the document snapshot', () => {
    const { getByText, getByLabelText } = renderDialog()

    fireEvent.input(getByLabelText('Name'), { target: { value: 'Renamed' } })
    fireEvent.input(getByLabelText('Document content'), { target: { value: '# changed' } })
    fireEvent.click(getByText('Reset'))

    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Notes')
    expect((getByLabelText('Document content') as HTMLTextAreaElement).value).toBe('# hello')
    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})
