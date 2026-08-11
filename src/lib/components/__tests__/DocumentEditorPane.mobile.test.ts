// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
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

  it('toggles between editor and preview with a single preview button instead of a split view', async () => {
    const { getByRole, queryByLabelText } = render(MobileEditorHost, { docType: 'markdown' })

    expect(queryByLabelText('Editor view')).toBeNull()
    const preview = getByRole('button', { name: 'Preview' })
    expect(preview.getAttribute('aria-pressed')).toBe('false')

    await fireEvent.click(preview)
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed')).toBe('true'),
    )

    await fireEvent.click(getByRole('button', { name: 'Preview' }))
    await vi.waitFor(() =>
      expect(getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed')).toBe('false'),
    )
  })

  it('shows clone and format in the kebab menu instead of toolbar buttons on mobile', async () => {
    const onClone = vi.fn()
    const { getByLabelText, getByRole, queryByLabelText, queryByText } = render(MobileEditorHost, {
      docType: 'json',
      withClone: true,
      onClone,
    })

    expect(queryByLabelText('Clone document')).toBeNull()
    expect(queryByLabelText('Format JSON')).toBeNull()

    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(queryByText('Clone')).toBeTruthy()
    expect(queryByText('Format JSON')).toBeTruthy()

    await fireEvent.click(queryByText('Clone')!)

    expect(onClone).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(getByRole('button', { name: 'More actions' }).getAttribute('aria-expanded')).toBe('false'))
  })

  it('omits the kebab menu when there are no applicable actions', async () => {
    const { queryByLabelText } = render(MobileEditorHost, { docType: 'markdown', withClone: false })

    expect(queryByLabelText('More actions')).toBeNull()
  })
})
