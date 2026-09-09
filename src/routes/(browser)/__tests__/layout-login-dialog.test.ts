// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutCollapseHost from './LayoutCollapseHost.svelte'
import { goto } from '$app/navigation'
import { setPage } from '../../../test/mocks/app-stores'

const signedInUser = { id: 1, username: 'alice', email: 'alice@example.com' }

let sessionUser: typeof signedInUser | null = null
let loginAsAdmin = false

function mockFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const target = String(url)
    let result: unknown
    if (target.endsWith('/api/auth/login') && init?.method === 'POST') {
      if (loginAsAdmin) {
        result = { admin: true }
      } else {
        sessionUser = signedInUser
        result = { user: signedInUser }
      }
    } else if (target.includes('/api/auth/session')) {
      result = { user: sessionUser, admin: null }
    } else if (target.includes('/api/user/preferences')) {
      result = { preferredLanguage: 'en' }
    } else {
      result = { documents: [], hasMore: false }
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => result })
  })
}

function stubDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('Header login dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(goto).mockClear()
    sessionUser = null
    loginAsAdmin = false
    stubDesktop()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
    vi.stubGlobal('fetch', mockFetch())
  })

  it('opens a login dialog instead of navigating to /login', async () => {
    const { getByRole, getByLabelText } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Login' })).toBeTruthy()
    })

    await fireEvent.click(getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(getByRole('dialog')).toBeTruthy()
      expect(getByLabelText('Username or email')).toBeTruthy()
    })
    expect(goto).not.toHaveBeenCalledWith('/login')
  })

  it('signs in through the dialog and refreshes the header identity', async () => {
    const { getByRole, getByLabelText, getByText, queryByRole } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Login' })).toBeTruthy()
    })
    await fireEvent.click(getByRole('button', { name: 'Login' }))

    const identifier = await waitFor(() => getByLabelText('Username or email'))
    await fireEvent.input(identifier, { target: { value: 'alice' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('Continue'))

    await waitFor(() => {
      expect(queryByRole('dialog')).toBeNull()
    })
    await waitFor(() => {
      expect(getByRole('button', { name: 'Settings' })).toBeTruthy()
      expect(getByRole('button', { name: 'Sign out' })).toBeTruthy()
    })
  })

  it('keeps a normal user on the browser page after dialog sign-in', async () => {
    const { getByRole, getByLabelText, getByText } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Login' })).toBeTruthy()
    })
    await fireEvent.click(getByRole('button', { name: 'Login' }))

    const identifier = await waitFor(() => getByLabelText('Username or email'))
    await fireEvent.input(identifier, { target: { value: 'alice' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('Continue'))

    await waitFor(() => {
      expect(getByRole('button', { name: 'Settings' })).toBeTruthy()
    })
    expect(goto).not.toHaveBeenCalledWith('/admin/general')
  })

  it('redirects an admin sign-in to the admin console', async () => {
    loginAsAdmin = true
    const { getByRole, getByLabelText, getByText } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(getByRole('button', { name: 'Login' })).toBeTruthy()
    })
    await fireEvent.click(getByRole('button', { name: 'Login' }))

    const identifier = await waitFor(() => getByLabelText('Username or email'))
    await fireEvent.input(identifier, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'adminpass' } })
    await fireEvent.click(getByText('Continue'))

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/admin/general')
    })
  })

  it('auto-opens the login dialog on ?login=1 (the /login redirect target)', async () => {
    setPage({ params: {}, url: new URL('http://localhost/?login=1'), route: { id: '/' } })
    const { getByRole, getByLabelText } = render(LayoutCollapseHost)

    await waitFor(() => {
      expect(getByRole('dialog')).toBeTruthy()
      expect(getByLabelText('Username or email')).toBeTruthy()
    })
  })
})
