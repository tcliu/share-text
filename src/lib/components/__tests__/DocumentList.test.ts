// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DocumentList from '../DocumentList.svelte'
import { goto } from '$app/navigation'

function renderList(props: Record<string, unknown> = {}) {
  return render(DocumentList, {
    documents: [],
    loading: false,
    error: null,
    selectedId: null,
    hasMore: false,
    onNew: vi.fn(),
    onRefresh: vi.fn(),
    onLogin: vi.fn(),
    onLoadMore: vi.fn(),
    ...props,
  })
}

describe('DocumentList', () => {
  it('shows the profile button for a signed-in user', async () => {
    const { getByLabelText, queryByLabelText } = renderList({
      user: { username: 'alice', email: 'alice@example.com' },
    })

    expect(getByLabelText('Profile')).toBeTruthy()
    expect(queryByLabelText('Admin console')).toBeNull()
  })

  it('shows the admin console button instead of profile for an admin', async () => {
    const { getByLabelText, queryByLabelText } = renderList({
      user: { username: 'admin' },
      isAdmin: true,
      onAdmin: vi.fn(),
    })

    expect(getByLabelText('Admin console')).toBeTruthy()
    expect(queryByLabelText('Profile')).toBeNull()
  })

  it('navigates to /admin when the admin console button is clicked', async () => {
    const { getByLabelText } = renderList({
      user: { username: 'admin' },
      isAdmin: true,
      onAdmin: () => goto('/admin'),
    })

    fireEvent.click(getByLabelText('Admin console'))

    expect(goto).toHaveBeenCalledWith('/admin')
  })

  it('shows the login button when signed out', async () => {
    const { getByLabelText, queryByLabelText } = renderList()

    expect(getByLabelText('Login')).toBeTruthy()
    expect(queryByLabelText('Profile')).toBeNull()
    expect(queryByLabelText('Admin console')).toBeNull()
  })

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
