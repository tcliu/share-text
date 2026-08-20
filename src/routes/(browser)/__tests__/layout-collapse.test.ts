// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutCollapseHost from './LayoutCollapseHost.svelte'
import { goto } from '$app/navigation'
import { setPage } from '../../../test/mocks/app-stores'

const existingDoc = { id: 'aaaaaa', name: 'Existing', updatedAt: '2026-08-01T00:00:00.000Z', updatedBy: '203.0.113.7' }
const signedInUser = { id: 1, username: 'alice', email: 'alice@example.com' }

function stubDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes('/api/auth/session')
          ? { user: signedInUser, admin: null }
          : String(url).includes('/api/auth/logout')
            ? { ok: true }
            : String(url).includes('/api/user/preferences')
              ? { preferredLanguage: 'en', ttsVoices: {} }
              : { documents: [existingDoc], hasMore: false },
    }),
  )
}

describe('Collapse document list focus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(goto).mockClear()
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

  it('prompts to discard unsaved changes before opening settings', async () => {
    const confirmDiscard = vi.fn()
    const { getByRole, getByText, queryByText } = render(LayoutCollapseHost, {
      withDirtyGuard: true,
      confirmDiscard,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
      expect(getByRole('button', { name: 'Settings' })).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await fireEvent.click(getByRole('button', { name: 'Settings' }))

    await waitFor(() => {
      expect(getByText('Discard unsaved changes?')).toBeTruthy()
    })
    expect(goto).not.toHaveBeenCalledWith('/settings')
    expect(confirmDiscard).not.toHaveBeenCalled()
  })

  it('prompts to discard unsaved changes before signing out', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    const confirmDiscard = vi.fn()
    const { getByRole, getByText, queryByText } = render(LayoutCollapseHost, {
      withDirtyGuard: true,
      confirmDiscard,
    })

    await waitFor(() => {
      expect(queryByText('Existing')).toBeTruthy()
      expect(getByRole('button', { name: 'Sign out' })).toBeTruthy()
    })

    setPage({ params: { id: 'aaaaaa' }, url: new URL('http://localhost/aaaaaa'), route: { id: '/[id]' } })

    await fireEvent.click(getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(getByText('Discard unsaved changes?')).toBeTruthy()
    })
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/api/auth/logout') && init?.method === 'POST')).toBe(false)
    expect(confirmDiscard).not.toHaveBeenCalled()
  })
})
