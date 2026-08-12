// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../+page.svelte'
import { goto } from '$app/navigation'

const authMocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  isAdminConfigured: vi.fn(),
}))

vi.mock('$lib/server/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/admin-auth')>('$lib/server/admin-auth')
  return {
    ...actual,
    isAdminSession: authMocks.isAdminSession,
    isAdminConfigured: authMocks.isAdminConfigured,
  }
})

import { load } from '../+page.server'

function renderPage(configured: boolean) {
  return render(LoginPage, { data: { configured } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  authMocks.isAdminSession.mockReset()
  authMocks.isAdminConfigured.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }),
  )
})

describe('/login page', () => {
  it('renders the login form when admin is configured', async () => {
    const { getByLabelText } = renderPage(true)

    await waitFor(() => {
      expect(getByLabelText('Username')).toBeTruthy()
      expect(getByLabelText('Password')).toBeTruthy()
      expect(getByLabelText('Remember me')).toBeTruthy()
    })
  })

  it('reports a clear message when admin is not configured', async () => {
    const { getByText } = renderPage(false)

    await waitFor(() => {
      expect(getByText(/Admin authentication is not configured/)).toBeTruthy()
    })
  })

  it('navigates to /admin/properties after signing in', async () => {
    const { getByLabelText, getByText } = renderPage(true)
    const username = await waitFor(() => getByLabelText('Username'))
    await fireEvent.input(username, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/admin/properties')
    })
  })

  it('remembers the username across sign-ins', async () => {
    const { getByLabelText, getByText } = renderPage(true)
    const username = await waitFor(() => getByLabelText('Username'))
    await fireEvent.input(username, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('share-text-admin-remembered-login') ?? '{}')).toEqual({
        username: 'admin',
      })
    })
  })

  it('restores the remembered username and check state on a fresh visit', async () => {
    localStorage.setItem('share-text-admin-remembered-login', JSON.stringify({ username: 'admin' }))
    const { getByLabelText } = renderPage(true)

    await waitFor(() => {
      expect((getByLabelText('Username') as HTMLInputElement).value).toBe('admin')
      expect((getByLabelText('Remember me') as HTMLInputElement).checked).toBe(true)
    })
  })

  it('persists the remembered state across a full sign-in and re-visit cycle', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const { getByLabelText, getByText, unmount } = renderPage(true)
    const username = await waitFor(() => getByLabelText('Username'))
    await fireEvent.input(username, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))
    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/admin/properties')
    })
    expect(JSON.parse(localStorage.getItem('share-text-admin-remembered-login') ?? '{}')).toEqual({
      username: 'admin',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/login',
      expect.objectContaining({ body: JSON.stringify({ username: 'admin', password: 'secret', rememberMe: true }) }),
    )

    unmount()
    const fresh = renderPage(true)
    await waitFor(() => {
      expect((fresh.getByLabelText('Username') as HTMLInputElement).value).toBe('admin')
      expect((fresh.getByLabelText('Remember me') as HTMLInputElement).checked).toBe(true)
    })
  })
})

describe('/login server load', () => {
  it('redirects to /admin/properties when already authenticated', async () => {
    authMocks.isAdminSession.mockReturnValue(true)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /admin/properties')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/admin/properties')
    }
  })

  it('returns the configured flag when not authenticated', async () => {
    authMocks.isAdminSession.mockReturnValue(false)
    authMocks.isAdminConfigured.mockReturnValue(true)
    const result = await load({ cookies: { get: () => null } } as never)
    expect(result).toEqual({ configured: true })
  })
})
