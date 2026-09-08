// @vitest-environment jsdom
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

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
  {
    id: '0',
    documentId: 'a1b2c3',
    documentType: 'markdown',
    updatedBy: '203.0.113.7',
    createdAt: '2026-08-01T00:00:00.000Z',
    contentSize: 3,
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
  let resolvePendingVersionFetch: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.fetchDocumentVersions.mockResolvedValue(versions)
    documentsMocks.fetchDocumentVersion.mockImplementation(async (_id: string, versionId: number | string) => {
      const id = String(versionId)
      const summary = versions.find(version => version.id === id)
      if (!summary) return null
      const contents: Record<string, string> = { '2': '# v2', '1': '# v1', '0': '# v0' }
      return { ...summary, content: contents[id] }
    })
  })

  afterEach(() => {
    resolvePendingVersionFetch?.()
    resolvePendingVersionFetch = null
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

  it('shows a side-by-side diff comparing the selected version with the current content', async () => {
    const { findByText, getByText, getByLabelText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()
    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()

    await fireEvent.click(getByLabelText('Compare with current'))

    expect(await findByText('# v1')).toBeTruthy()
    expect(await findByText('# current')).toBeTruthy()
  })

  it('highlights added and removed lines in the diff', async () => {
    const { findByText, getByText, getByLabelText, getByTestId } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()
    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()

    await fireEvent.click(getByLabelText('Compare with current'))

    await waitFor(() => expect(getByTestId('history-diff')).toBeTruthy())
    const diff = getByTestId('history-diff')
    const removed = diff.querySelector('[class*="bg-rose"]')
    const added = diff.querySelector('[class*="bg-emerald"]')
    expect(removed?.textContent).toContain('# v1')
    expect(added?.textContent).toContain('# current')
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

  it('fills the entire screen on mobile', () => {
    const { getByTestId } = renderDialog({ isMobile: true })

    const overlay = getByTestId('dialog-overlay')
    expect(overlay.className).toContain('bg-slate-950')
    expect(overlay.className).not.toContain('/80')
    expect(overlay.className).not.toContain('px-4')
  })

  it('keeps the centered modal layout on desktop', () => {
    const { getByTestId } = renderDialog()

    const overlay = getByTestId('dialog-overlay')
    expect(overlay.className).toContain('bg-slate-950/80')
    // The overlay is a bare dismiss button; desktop padding lives on the
    // sibling centering wrapper.
    expect(overlay.nextElementSibling?.className).toContain('px-4')
  })

  it('gives the content pane a fixed height so the dialog does not resize across versions', async () => {
    const { findByText, getByTestId } = renderDialog()

    await findByText('# v2')

    const contentPane = getByTestId('history-content-pane')
    expect(contentPane).toBeTruthy()
    expect(contentPane.className).toContain('h-[60vh]')
    expect(contentPane.className).toContain('min-h-0')
    expect(contentPane.className).toContain('md:h-full')
  })

  it('disables compare and restore while a version is loading so Restore never acts on a stale version', async () => {
    const { findByText, getByText, getByLabelText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()

    let resolveFetch!: () => void
    resolvePendingVersionFetch = () => resolveFetch()
    documentsMocks.fetchDocumentVersion.mockReturnValueOnce(new Promise<void>(resolve => (resolveFetch = resolve)))
    fireEvent.click(getByText('203.0.113.7 · 5 chars'))

    await waitFor(() => {
      expect((getByLabelText('Compare with current') as HTMLButtonElement).disabled).toBe(true)
      expect((getByLabelText('Restore version') as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('drops a stale response when a newer selection resolves first', async () => {
    const { findByText, getByText, queryByText } = renderDialog()

    expect(await findByText('# v2')).toBeTruthy()

    let resolveSlowV1!: () => void
    resolvePendingVersionFetch = () => resolveSlowV1()
    documentsMocks.fetchDocumentVersion
      .mockReturnValueOnce(new Promise<void>(resolve => (resolveSlowV1 = resolve)))
      .mockReturnValueOnce(Promise.resolve({ ...versions[2], content: '# v0' }))

    fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    fireEvent.click(getByText('203.0.113.7 · 3 chars'))

    expect(await findByText('# v0')).toBeTruthy()

    resolveSlowV1()
    await waitFor(() => expect(queryByText('# v1')).toBeNull())
    expect(queryByText('# v0')).toBeTruthy()
  })

  it('always shows compare and restore, disabling them when the selected version matches current', async () => {
    const { findByText, getByText, getByLabelText } = renderDialog({
      currentContent: '# v2',
      currentType: 'markdown',
    })

    expect(await findByText('# v2')).toBeTruthy()
    const matchingCompare = getByLabelText('Compare with current') as HTMLButtonElement
    const matchingRestore = getByLabelText('Restore version') as HTMLButtonElement
    expect(matchingCompare.disabled).toBe(true)
    expect(matchingRestore.disabled).toBe(true)

    await fireEvent.mouseEnter(matchingCompare.parentElement!)
    expect(screen.queryByRole('tooltip')).toBeNull()
    await fireEvent.mouseLeave(matchingCompare.parentElement!)

    await fireEvent.click(getByText('203.0.113.7 · 5 chars'))
    expect(await findByText('# v1')).toBeTruthy()

    const differingCompare = getByLabelText('Compare with current') as HTMLButtonElement
    const differingRestore = getByLabelText('Restore version') as HTMLButtonElement
    expect(differingCompare.disabled).toBe(false)
    expect(differingRestore.disabled).toBe(false)

    await fireEvent.mouseEnter(differingCompare.parentElement!)
    expect(screen.getByRole('tooltip').textContent).toContain('Compare with current')
  })
})
