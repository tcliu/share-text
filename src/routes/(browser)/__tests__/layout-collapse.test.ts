// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutCollapseHost from './LayoutCollapseHost.svelte'
import { setPage } from '../../../test/mocks/app-stores'

const existingDoc = { id: 'aaaaaa', name: 'Existing', updatedAt: '2026-08-01T00:00:00.000Z', updatedBy: '203.0.113.7' }

function stubDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function mockFetch() {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ documents: [existingDoc], hasMore: false }),
    }),
  )
}

describe('Collapse document list focus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubDesktop()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
    vi.stubGlobal('fetch', mockFetch())
  })

  it('restores editor focus after collapsing and expanding the document list', async () => {
    const { getByRole, queryByText } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    const collapseButton = getByRole('button', { name: 'Collapse document list' })
    collapseButton.focus()
    expect(document.activeElement).toBe(collapseButton)

    await fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Show document list' })).toBeTruthy()
    })
    expect(document.activeElement).toBe(getByRole('button', { name: 'Editor focus target' }))

    const showButton = getByRole('button', { name: 'Show document list' })
    showButton.focus()
    await fireEvent.click(showButton)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Collapse document list' })).toBeTruthy()
    })
    expect(document.activeElement).toBe(getByRole('button', { name: 'Editor focus target' }))
  })
})
