// @vitest-environment jsdom
import { render, waitFor, fireEvent } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snippet } from 'svelte'
import Layout from '../+layout.svelte'
import LayoutDrawerHost from './LayoutDrawerHost.svelte'
import { setPage } from '../../../test/mocks/app-stores'

const existingDoc = { id: 'aaaaaa', name: 'Existing', updatedAt: '2026-08-01T00:00:00.000Z', updatedBy: '203.0.113.7' }

// The layout's drawer behavior follows the shared AppShell's own dock/floating
// presentation (its container width), not a viewport media query. Simulate a
// narrow shell container so the pane floats; matchMedia still reports mobile
// for the editor toolbar's `isMobile` context.
const NARROW_CONTAINER_WIDTH = 375

function stubNarrowShell() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  class NarrowResizeObserver {
    callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe() {
      this.callback(
        [{ contentRect: { width: NARROW_CONTAINER_WIDTH } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', NarrowResizeObserver)
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes('limit')
          ? { documents: [existingDoc], hasMore: false }
          : { documents: [existingDoc], hasMore: false },
    }),
  )
}

describe('Mobile layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubNarrowShell()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
    vi.stubGlobal('fetch', mockFetch())
  })

  it('shows the document list on the list route', async () => {
    const { queryByText, queryByPlaceholderText, getAllByRole } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })
    expect(queryByPlaceholderText('Search documents...')).toBeTruthy()
    expect(getAllByRole('button', { name: 'Collapse document list' }).length).toBeGreaterThan(0)
    expect(queryByText('Back to document list')).toBeNull()
  })

  it('hides the document list when a document is open', async () => {
    const { queryByText, queryByPlaceholderText } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeNull()
    })
  })

  it('opens the document list in a drawer on the editor page and closes it', async () => {
    const { getByTestId, getAllByRole, queryByPlaceholderText, queryByText } = render(LayoutDrawerHost)

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeNull()
    })

    await fireEvent.click(getByTestId('open-drawer'))

    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeTruthy()
    })
    expect(queryByText('Existing')).toBeTruthy()

    const collapseButtons = getAllByRole('button', { name: 'Collapse document list' })
    await fireEvent.click(collapseButtons[collapseButtons.length - 1])

    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeNull()
    })
  })

  it('toggles the drawer from the header', async () => {
    const { getByTestId, getAllByRole, getByRole, queryByPlaceholderText } = render(LayoutDrawerHost)

    await waitFor(() => {
      expect(getByTestId('open-drawer')).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await fireEvent.click(getByTestId('open-drawer'))
    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeTruthy()
    })

    await fireEvent.click(getAllByRole('button', { name: 'Collapse document list' })[0])
    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeNull()
    })

    await fireEvent.click(getByRole('button', { name: 'Show document list' }))
    await waitFor(() => {
      expect(queryByPlaceholderText('Search documents...')).toBeTruthy()
    })
  })
})
