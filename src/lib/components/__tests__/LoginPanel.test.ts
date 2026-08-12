// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPanel from '../LoginPanel.svelte'

const STORAGE_KEY = 'share-text-admin-remembered-login'

function renderPanel() {
  return render(LoginPanel, {
    configured: true,
    onAuthenticated: vi.fn(),
    onClose: vi.fn(),
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }),
  )
})

describe('LoginPanel remember me', () => {
  it('shows a Remember me checkbox', () => {
    renderPanel()
    expect(screen.getByLabelText('Remember me')).toBeTruthy()
  })

  it('pre-fills the saved username and checks the box when remembered', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'admin' }))
    renderPanel()

    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('admin')
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Remember me') as HTMLInputElement).checked).toBe(true)
  })

  it('saves only the username to localStorage when signing in with Remember me', async () => {
    const { getByText, getByLabelText } = renderPanel()

    await fireEvent.input(getByLabelText('Username'), { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ username: 'admin' })
    })
  })

  it('passes the rememberMe flag to the login request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const { getByText, getByLabelText } = renderPanel()

    await fireEvent.input(getByLabelText('Username'), { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/login',
        expect.objectContaining({ body: JSON.stringify({ username: 'admin', password: 'secret', rememberMe: true }) }),
      )
    })
  })

  it('removes stored credentials when signing in without Remember me', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'admin' }))
    const { getByText, getByLabelText } = renderPanel()

    await waitFor(() => {
      expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('admin')
    })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  it('toggles the checkbox when the visual box is clicked', async () => {
    const { container } = renderPanel()
    const box = container.querySelector('label span[aria-hidden="true"]') as HTMLElement
    const input = container.querySelector('input[aria-label="Remember me"]') as HTMLInputElement
    expect(input.checked).toBe(false)
    await fireEvent.click(box)
    await waitFor(() => {
      expect(input.checked).toBe(true)
    })
    expect(box.className).toContain('bg-cyan-300')
  })

  it('does not store the password in localStorage', async () => {
    const { getByText, getByLabelText } = renderPanel()

    await fireEvent.input(getByLabelText('Username'), { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'sup3r-secret' } })
    await fireEvent.click(getByLabelText('Remember me'))
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(JSON.stringify(localStorage.getItem(STORAGE_KEY) ?? '{}')).not.toContain('sup3r-secret')
    })
  })
})
