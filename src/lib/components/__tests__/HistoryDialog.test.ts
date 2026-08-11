// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  fetchDocumentVersions: vi.fn(),
  fetchDocumentVersion: vi.fn(),
}))

vi.mock('$lib/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/documents')>('$lib/documents')
  return {
    ...actual,
    fetchDocumentVersions: documentsMocks.fetchDocumentVersions,
    fetchDocumentVersion: documentsMocks.fetchDocumentVersion,
  }
})

import HistoryDialog from '../HistoryDialog.svelte'

const versions = [
  {
    id: '2',
    documentId: 'a1b2c3',
    documentType: 'markdown',
    updatedBy: '203.0.113.7',
    createdAt: '2026-08-03T00:00:00.000Z',
    contentSize: 12,
  },
  {
    id: '1',
    documentId: 'a1b2c3',
    documentType: 'markdown',
    updatedBy: '203.0.113.7',
    createdAt: '2026-08-02T00:00:00.000Z',
    contentSize: 5,
  },
]

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(HistoryDialog, {
    props: {
      open: true,
      documentId: 'a1b2c3',
      currentContent: '# current',
      currentType: 'markdown',
      hasUnsavedChanges: false,
      onClose: () => {},
      onRestore: () => {},
      ...overrides,
    },
  })
}

describe('HistoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentVersions.mockResolvedValue(versions)
    documentsMocks.fetchDocumentVersion.mockImplementation(async (_id: string, versionId: number | string) => {
      const id = String(versionId)
      const summary = versions.find(version => version.id === id)
      if (!summary) return null
      return { ...summary, content: id === '2' ? '# v2' : '# v1' }
    })
  })

  it('loads the version list and auto-selects the newest version', async () => {
    const { findByText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()
    expect(documentsMocks.fetchDocumentVersions).toHaveBeenCalledWith('a1b2c3')
    expect(documentsMocks.fetchDocumentVersion).toHaveBeenCalledWith('a1b2c3', '2')
  })

  it('loads the content of the selected version', async () => {
    const { findByText, getByText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()
    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))

    expect(await findByText('# v1')).toBeTruthy()
    expect(documentsMocks.fetchDocumentVersion).toHaveBeenCalledWith('a1b2c3', '1')
  })

  it('restores the selected version through onRestore', async () => {
    const onRestore = vi.fn()
    const { findByText, getByLabelText } = renderDialog({ onRestore })

    await findByText('# v2')
    await fireEvent.click(getByLabelText('Restore version'))

    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ content: '# v2' }))
  })

  it('confirms before restoring when the editor has unsaved changes', async () => {
    const onRestore = vi.fn()
    const { findByText, getByText, getByLabelText } = renderDialog({ hasUnsavedChanges: true, onRestore })

    await findByText('# v2')
    await fireEvent.click(getByLabelText('Restore version'))

    expect(onRestore).not.toHaveBeenCalled()
    expect(getByText('Restore this version?')).toBeTruthy()

    await fireEvent.click(getByText('Restore'))
    expect(onRestore).toHaveBeenCalledTimes(1)
  })

  it('splits the pane to compare the selected version with the current content', async () => {
    const { findByText, getByText, getByLabelText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()
    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()

    await fireEvent.click(getByLabelText('Compare with current'))

    expect(getByText('# v1')).toBeTruthy()
    expect(getByText('# current')).toBeTruthy()
  })

  it('shows each pane own document type when the types differ', async () => {
    const { findByText, getByText, getByLabelText } = renderDialog({ currentType: 'text' })

    expect(await findByText('# v2')).toBeTruthy()
    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()

    await fireEvent.click(getByLabelText('Compare with current'))

    expect(getByText('markdown')).toBeTruthy()
    expect(getByText('text')).toBeTruthy()
  })

  it('hides compare and restore when the selected version already matches current', async () => {
    const { findByText, getByText, getByLabelText, queryByLabelText } = renderDialog({
      currentContent: '# v2',
      currentType: 'markdown',
    })

    expect(await findByText('# v2')).toBeTruthy()
    expect(queryByLabelText('Compare with current')).toBeNull()
    expect(queryByLabelText('Restore version')).toBeNull()

    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()
    expect(getByLabelText('Compare with current')).toBeTruthy()
    expect(getByLabelText('Restore version')).toBeTruthy()
  })
})
