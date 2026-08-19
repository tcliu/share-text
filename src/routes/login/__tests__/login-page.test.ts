// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../+page.svelte'
import { goto } from '$app/navigation'

const authMocks = vi.hoisted(() => ({
  isUserSession: vi.fn(),
}))

vi.mock('$lib/server/user-auth', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/user-auth')>('$lib/server/user-auth')
  return {
    ...actual,
    isUserSession: authMocks.isUserSession,
  }
})

import { load } from '../+page.server'

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.isUserSession.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: 1, username: 'alice', email: 'alice@example.com' } }) }),
  )
})

describe('/login page', () => {
  it('renders the sign-in form', async () => {
    const { getByLabelText } = render(LoginPage)

    await waitFor(() => {
      expect(getByLabelText('Username or email')).toBeTruthy()
      expect(getByLabelText('Password')).toBeTruthy()
      expect(getByLabelText('Remember me')).toBeTruthy()
    })
  })

  it('switches to the create account form', async () => {
    const { getByText, getByLabelText } = render(LoginPage)
    await fireEvent.click(getByText('Create account'))

    await waitFor(() => {
      expect(getByLabelText('Username')).toBeTruthy()
      expect(getByLabelText('Email')).toBeTruthy()
      expect(getByLabelText('Password')).toBeTruthy()
    })
  })

  it('focuses the username input when switching to create account', async () => {
    const { getByText } = render(LoginPage)
    await fireEvent.click(getByText('Create account'))

    await waitFor(() => {
      expect(document.activeElement?.id).toBe('register-username')
    })
  })

  it('navigates to / after signing in', async () => {
    const { getByLabelText, getByText } = render(LoginPage)
    const identifier = await waitFor(() => getByLabelText('Username or email'))
    await fireEvent.input(identifier, { target: { value: 'alice' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('Continue'))

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/')
    })
  })

  it('navigates to the admin console after an admin sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ admin: true }) }),
    )
    const { getByLabelText, getByText } = render(LoginPage)
    const identifier = await waitFor(() => getByLabelText('Username or email'))
    await fireEvent.input(identifier, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'adminpass' } })
    await fireEvent.click(getByText('Continue'))

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/admin/general')
    })
  })
})

describe('/login server load', () => {
  it('redirects to / when already authenticated', async () => {
    authMocks.isUserSession.mockReturnValue(true)
    try {
      await load({ cookies: { get: () => null } } as never)
      expect.unreachable('expected a redirect to /')
    } catch (error) {
      const redirect = error as { status?: number; location?: string }
      expect(redirect.status).toBe(307)
      expect(redirect.location).toBe('/')
    }
  })

  it('does not redirect when not authenticated', async () => {
    authMocks.isUserSession.mockReturnValue(false)
    const result = await load({ cookies: { get: () => null } } as never)
    expect(result).toBeUndefined()
  })
})
