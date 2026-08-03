// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDialog from '../AdminDialog.svelte'

const settings = [
  {
    key: 'max_documents_per_ip',
    label: 'Max documents per IP',
    description: 'Maximum number of documents a single client IP can create.',
    defaultValue: 10,
    envKey: 'MAX_DOCUMENTS_PER_IP',
    min: 1,
    max: 1000,
    value: 10,
    source: 'environment',
  },
]

function mockFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const path = String(url)
    if (path.endsWith('/api/admin/session')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ authenticated: false, configured: true }) })
    }
    if (path.endsWith('/api/admin/login')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }
    if (path.endsWith('/api/admin/settings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ settings }) })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
  })
}

function renderDialog() {
  return render(AdminDialog, {
    onClose: vi.fn(),
    onAdminDelete: vi.fn(),
    onAdminChange: vi.fn(),
  })
}

describe('AdminDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the login form when unauthenticated', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { getByLabelText } = renderDialog()

    await waitFor(() => {
      expect(getByLabelText('Username')).toBeTruthy()
      expect(getByLabelText('Password')).toBeTruthy()
      expect(getByLabelText('Show password')).toBeTruthy()
    })
  })

  it('signs in and reveals the properties tab', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { getByLabelText, getByText } = renderDialog()

    const username = await waitFor(() => getByLabelText('Username'))
    const password = getByLabelText('Password')

    await fireEvent.input(username, { target: { value: 'admin' } })
    await fireEvent.input(password, { target: { value: 'secret' } })
    await fireEvent.click(getByText('Sign in'))

    await waitFor(() => {
      expect(getByText('Properties')).toBeTruthy()
      expect(getByText('Max documents per IP')).toBeTruthy()
    })
  })

  it('closes the login panel with the Escape key', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const onClose = vi.fn()
    render(AdminDialog, {
      onClose,
      onAdminDelete: vi.fn(),
      onAdminChange: vi.fn(),
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Username')).toBeTruthy()
    })
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('reports a clear message when admin is not configured', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/api/admin/session')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ authenticated: false, configured: false }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { getByText } = renderDialog()

    await waitFor(() => {
      expect(getByText(/Admin authentication is not configured/)).toBeTruthy()
    })
  })

  it('shows a selectable documents table', async () => {
    const documents = [
      {
        id: 'aaaaaa',
        name: 'Doc A',
        createdBy: '10.0.0.1',
        updatedBy: '10.0.0.2',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
        contentSize: 12,
      },
      {
        id: 'bbbbbb',
        name: 'Doc B',
        createdBy: '10.0.0.1',
        updatedBy: '10.0.0.1',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
        contentSize: 3,
      },
    ]
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const path = String(url)
      if (path.endsWith('/api/admin/session')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ authenticated: false, configured: true }),
        })
      }
      if (path.endsWith('/api/admin/login')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
      }
      if (path.endsWith('/api/admin/settings')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ settings }) })
      }
      if (path.includes('/api/admin/documents')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ documents, total: documents.length, hasMore: false }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { getByText, getByLabelText } = renderDialog()

    const username = await waitFor(() => getByLabelText('Username'))
    await fireEvent.input(username, { target: { value: 'admin' } })
    await fireEvent.input(getByLabelText('Password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('Sign in'))
    await waitFor(() => expect(getByText('Properties')).toBeTruthy())

    await fireEvent.click(getByText('Documents'))
    await waitFor(() => {
      expect(getByText('Updated by')).toBeTruthy()
      expect(getByText('Doc A')).toBeTruthy()
      expect(getByText('Doc B')).toBeTruthy()
    })

    await fireEvent.click(getByLabelText('Select all documents'))
    await waitFor(() => {
      expect((screen.getAllByLabelText(/Select document/)[0] as HTMLInputElement).checked).toBe(true)
      expect((screen.getAllByLabelText(/Select document/)[1] as HTMLInputElement).checked).toBe(true)
    })
  })
})
