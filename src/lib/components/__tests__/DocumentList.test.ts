// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DocumentList from '../DocumentList.svelte'

function renderList(props: Record<string, unknown> = {}) {
  return render(DocumentList, {
    documents: [],
    loading: false,
    error: null,
    selectedId: null,
    hasMore: false,
    onNew: vi.fn(),
    onRefresh: vi.fn(),
    onLoadMore: vi.fn(),
    ...props,
  })
}

describe('DocumentList', () => {
  it('renders document names as plain labels without a copy button', async () => {
    const { getByText, queryByLabelText } = renderList({
      documents: [
        {
          id: 'aaaaaa',
          name: 'My Doc',
          documentType: 'text',
          tags: [],
          updatedAt: '2026-08-01T00:00:00.000Z',
          updatedBy: '203.0.113.7',
          owned: true,
          editable: true,
          isPublic: true,
        },
      ],
    })

    expect(getByText('My Doc')).toBeTruthy()
    expect(queryByLabelText(/Copy document name/)).toBeNull()
  })
})