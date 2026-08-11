// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snippet } from 'svelte'
import Layout from '../+layout.svelte'
import { setPage } from '../../../test/mocks/app-stores'

const existingDoc = { id: 'aaaaaa', name: 'Existing', updatedAt: '2026-08-01T00:00:00.000Z', updatedBy: '203.0.113.7' }

function stubMobile() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
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
    stubMobile()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
    vi.stubGlobal('fetch', mockFetch())
  })

  it('shows the document list full screen on the list route', async () => {
    const { queryByText, queryByPlaceholderText } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })
    expect(queryByPlaceholderText('Search documents...')).toBeTruthy()
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
})
