// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import MobileEditorHost from './MobileEditorHost.svelte'

describe('DocumentEditorPane mobile header', () => {
  beforeEach(() => {
    localStorage.clear()
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(history, 'replaceState').mockImplementation(() => {})
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    })
  })

  it('shows the name, type selector, tags, and actions in stacked rows', async () => {
    const { getByLabelText, getByTestId, queryByText } = render(MobileEditorHost)

    expect(queryByText('My Document')).toBeTruthy()
    expect(getByLabelText('Document type')).toBeTruthy()
    expect(queryByText('alpha')).toBeTruthy()
    expect(queryByText('beta')).toBeTruthy()
    expect(getByTestId('editor-tags').className).toContain('flex-wrap')
    expect(getByTestId('editor-actions').className).toContain('flex-wrap')
    expect(getByLabelText('Save')).toBeTruthy()
  })

  it('offers an open-drawer button before the filename that opens the document list', async () => {
    const onOpenDrawer = vi.fn()
    const { getByLabelText } = render(MobileEditorHost, { onOpenDrawer })

    const drawerButton = getByLabelText('Open document list')
    await fireEvent.click(drawerButton)
    expect(onOpenDrawer).toHaveBeenCalledTimes(1)
  })

  it('shows both editor and preview toggles on mobile and turns on the stacked split when both are on', async () => {
    const { getByRole, getByLabelText, queryByLabelText } = render(MobileEditorHost, { docType: 'markdown' })

    const editorView = getByRole('button', { name: 'Editor view' })
    const previewView = getByRole('button', { name: 'Preview view' })
    expect(editorView.getAttribute('aria-pressed')).toBe('true')
    expect(previewView.getAttribute('aria-pressed')).toBe('false')
    expect(editorView.hasAttribute('disabled')).toBe(true)
    expect(queryByLabelText('Resize editor and preview panes')).toBeNull()

    await fireEvent.click(previewView)
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Preview view' }).getAttribute('aria-pressed')).toBe('true'),
    )
    expect(getByRole('button', { name: 'Editor view' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'Editor view' }).hasAttribute('disabled')).toBe(false)

    const splitter = getByLabelText('Resize editor and preview panes')
    expect(splitter.getAttribute('aria-orientation')).toBe('horizontal')

    await fireEvent.click(getByRole('button', { name: 'Preview view' }))
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Preview view' }).getAttribute('aria-pressed')).toBe('false'),
    )
    expect(queryByLabelText('Resize editor and preview panes')).toBeNull()
  })

  it('shows clone as a toolbar button after copy and keeps format in the kebab menu on mobile', async () => {
    const onClone = vi.fn()
    const { getByRole, queryByLabelText, queryByText } = render(MobileEditorHost, {
      docType: 'json',
      withClone: true,
      onClone,
    })

    const cloneButton = getByRole('button', { name: 'Clone document' })
    expect(queryByLabelText('Format JSON')).toBeNull()

    const copyButton = getByRole('button', { name: 'Copy' })
    const panel = cloneButton.closest('[data-testid="editor-actions"]')!
    const buttons: HTMLElement[] = Array.from(panel.querySelectorAll('button'))
    expect(buttons.indexOf(cloneButton)).toBeGreaterThan(buttons.indexOf(copyButton))

    await fireEvent.click(cloneButton)
    expect(onClone).toHaveBeenCalledTimes(1)

    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.click(trigger)
    expect(queryByText('Format JSON')).toBeTruthy()
    expect(queryByText('Clone')).toBeNull()
  })

  it('surfaces upload, export, and history through the kebab menu instead of toolbar buttons on mobile', async () => {
    const { getByRole, queryByLabelText, queryByText } = render(MobileEditorHost, {
      docType: 'markdown',
      withClone: false,
      versionCount: 3,
    })

    expect(queryByLabelText('Upload')).toBeNull()
    expect(queryByLabelText('Export')).toBeNull()
    expect(queryByLabelText('Version history')).toBeNull()

    const trigger = getByRole('button', { name: 'More actions' })
    expect(trigger.closest('[data-testid="editor-actions"]')!.querySelector('button')).toBe(trigger)
    await fireEvent.click(trigger)

    expect(queryByText('Upload')).toBeTruthy()
    expect(queryByText('Export')).toBeTruthy()
    expect(queryByText('History')).toBeTruthy()

    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map(node => node.textContent?.trim())
    expect(items.indexOf('Upload')).toBeLessThan(items.indexOf('Export'))
    expect(items.indexOf('Export')).toBeLessThan(items.indexOf('History'))
  })

  it('keeps upload and export in the kebab menu when history is unavailable', async () => {
    const { getByRole, queryByText } = render(MobileEditorHost, {
      docType: 'markdown',
      withClone: false,
      versionCount: 1,
    })

    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.click(trigger)

    expect(queryByText('Upload')).toBeTruthy()
    expect(queryByText('Export')).toBeTruthy()
    expect(queryByText('History')).toBeNull()
  })

  it('preserves the editor cursor position when closing the preview on mobile', async () => {
    const { getByRole } = render(MobileEditorHost, { docType: 'markdown' })

    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    const editor = document.querySelector<HTMLElement>('.cm-content')!
    const view = EditorView.findFromDOM(editor)!
    view.dispatch({ selection: { anchor: 3 } })

    const previewView = getByRole('button', { name: 'Preview view' })
    await fireEvent.click(previewView)
    await vi.waitFor(() => expect(previewView.getAttribute('aria-pressed')).toBe('true'))

    await fireEvent.click(getByRole('button', { name: 'Preview view' }))
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Preview view' }).getAttribute('aria-pressed')).toBe('false'),
    )

    await vi.waitFor(() => expect(document.activeElement).toBe(editor))
    expect(view.state.selection.main.head).toBe(3)
  })
})
