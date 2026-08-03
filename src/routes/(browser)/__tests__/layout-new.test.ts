// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snippet } from 'svelte'
import Layout from '../+layout.svelte'
import { goto } from '$app/navigation'
import { setPage } from '../../../test/mocks/app-stores'

const existingDoc = { id: 'aaaaaa', name: 'Existing', updatedAt: '2026-08-01T00:00:00.000Z' }
const newDoc = { id: 'newdoc', name: 'Untitled', updatedAt: '2026-08-03T00:00:00.000Z', content: '' }

function mockFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ document: newDoc }) })
    }
    if (String(url).includes('limit')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ documents: [newDoc, existingDoc], hasMore: false }) })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ documents: [existingDoc], hasMore: false }) })
  })
}

describe('New document flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(goto).mockClear()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
    vi.stubGlobal('fetch', mockFetch())
  })

  it('creates a document, navigates to it, and shows it in the list', async () => {
    const { getByLabelText, queryByText } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })

    await fireEvent.click(getByLabelText('New document'))

    await waitFor(() => {
      expect(goto).toHaveBeenCalled()
    })
    expect(goto).toHaveBeenCalledWith('/newdoc')

    await waitFor(() => {
      expect(queryByText('Untitled')).toBeTruthy()
    })
  })

  it('keeps other documents visible after selecting one', async () => {
    const { queryByText } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
      expect(queryByText('Untitled')).toBeTruthy()
    })
  })
})
