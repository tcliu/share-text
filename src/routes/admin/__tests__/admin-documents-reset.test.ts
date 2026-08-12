// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDocumentsStateHost from './AdminDocumentsStateHost.svelte'
import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'

type AdminDocumentsState = ReturnType<typeof useAdminDocuments>

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
    if (String(url).includes('/api/admin/documents')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ documents, total: documents.length, hasMore: false }),
      })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
  })
}

describe('useAdminDocuments reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', mockFetch())
  })

  it('clears loaded data, selection, page, and search so a fresh login reloads', async () => {
    let state: AdminDocumentsState | null = null
    render(AdminDocumentsStateHost, { props: { onReady: s => (state = s) } })

    await waitFor(() => expect(state!.loaded).toBe(true))
    expect(state!.documents.length).toBeGreaterThan(0)

    state!.toggleSelection(documents[0].id, true)
    expect(state!.selectedCount).toBe(1)
    state!.searchInput = 'doc'
    state!.handleSort('name', 'asc')

    state!.reset()

    expect(state!.loaded).toBe(false)
    expect(state!.documents).toEqual([])
    expect(state!.page).toBe(1)
    expect(state!.selectedCount).toBe(0)
    expect(state!.searchInput).toBe('')
    expect(state!.searchQuery).toBe('')
    expect(state!.sortBy).toBe('updatedAt')
    expect(state!.sortDir).toBe('desc')
  })
})
