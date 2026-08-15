// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from '../+layout.svelte'
import { page } from '$app/state'
import { goto } from '$app/navigation'

const settings = [
  {
    key: 'max_documents_per_ip',
    label: 'Max documents per IP',
    description: 'Maximum number of documents a single client IP can create.',
    kind: 'number',
    defaultValue: 10,
    envKey: 'MAX_DOCUMENTS_PER_IP',
    min: 1,
    max: 1000,
    value: 10,
    source: 'environment',
  },
]

const documents = [
  {
    id: 'aaaaaa',
    name: 'Doc A',
    documentType: 'text',
    tags: [{ name: 'alpha', color: '#00F0FF' }],
    createdBy: '10.0.0.1',
    updatedBy: '10.0.0.2',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    contentSize: 12,
  },
  {
    id: 'bbbbbb',
    name: 'Doc B',
    documentType: 'markdown',
    tags: [],
    createdBy: '10.0.0.1',
    updatedBy: '10.0.0.1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    contentSize: 3,
  },
]

function mockFetch() {
  return vi.fn().mockImplementation((url: string) => {
    const path = String(url)
    if (path.endsWith('/api/admin/session')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true, configured: true }),
      })
    }
    if (path.includes('/api/admin/settings')) {
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
}

describe('admin layout route tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    page.url = new URL('http://localhost/admin/properties') as typeof page.url
    vi.stubGlobal('fetch', mockFetch())
  })

  it('renders the tab chrome and properties content when authenticated', async () => {
    const { getByRole, getByText } = render(Layout)

    const propertiesLink = await waitFor(() => getByRole('link', { name: 'Properties' }))
    const documentsLink = getByRole('link', { name: 'Documents' })
    expect(propertiesLink.getAttribute('href')).toBe('/admin/properties')
    expect(documentsLink.getAttribute('href')).toBe('/admin/documents')
    expect(propertiesLink.getAttribute('aria-current')).toBe('page')
    expect(documentsLink.getAttribute('aria-current')).toBeNull()

    expect(getByText('Reload')).toBeTruthy()
    await waitFor(() => {
      expect(getByText('Max documents per IP')).toBeTruthy()
    })
  })

  it('shows the top header row only when authenticated', async () => {
    const { getByLabelText } = render(Layout)

    await waitFor(() => {
      expect(getByLabelText('Sign out')).toBeTruthy()
      expect(getByLabelText('Go to Documents')).toBeTruthy()
    })
  })

  it('highlights the documents tab, shows its toolbar, and renders the documents list', async () => {
    page.url = new URL('http://localhost/admin/documents') as typeof page.url
    const { getByLabelText, getByRole, getByText } = render(Layout)

    const propertiesLink = await waitFor(() => getByRole('link', { name: 'Properties' }))
    const documentsLink = getByRole('link', { name: 'Documents' })
    expect(propertiesLink.getAttribute('aria-current')).toBeNull()
    expect(documentsLink.getAttribute('aria-current')).toBe('page')

    expect(getByLabelText('Delete selected')).toBeTruthy()
    await waitFor(() => {
      expect(getByText('Doc A')).toBeTruthy()
      expect(getByText('Doc B')).toBeTruthy()
    })

    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect([...boxes].filter(box => box.checked).length).toBe(0)
  })

  it('redirects to /login/admin when the session is not authenticated', async () => {
    page.url = new URL('http://localhost/admin/documents') as typeof page.url
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (String(url).endsWith('/api/admin/session')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ authenticated: false, configured: true }),
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
      }),
    )
    render(Layout)

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/login/admin')
    })
  })

  it('shows a retryable error state instead of redirecting on a transient session check failure', async () => {
    page.url = new URL('http://localhost/admin/properties') as typeof page.url
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { getByText, getByLabelText } = render(Layout)

    await waitFor(() => {
      expect(getByText('network down')).toBeTruthy()
      expect(getByLabelText('Retry')).toBeTruthy()
    })
    expect(goto).not.toHaveBeenCalled()
  })
})
