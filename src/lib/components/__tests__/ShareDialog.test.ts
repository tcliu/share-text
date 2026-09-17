// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import type { ComponentProps } from 'svelte'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import ShareDialog from '../ShareDialog.svelte'
import { fetchRecentSharees, searchUsers } from '$lib/user-auth'
import { getDefaultTagColor } from '$lib/tag-colors'

vi.mock('$lib/user-auth', () => ({
  searchUsers: vi.fn(),
  fetchRecentSharees: vi.fn(),
}))

const mockedSearchUsers = vi.mocked(searchUsers)
const mockedFetchRecentSharees = vi.mocked(fetchRecentSharees)

type Props = ComponentProps<typeof ShareDialog>

function renderDialog(overrides: Partial<Props> = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onApply = overrides.onApply ?? vi.fn()
  const rendered = render(ShareDialog, {
    props: {
      open: true,
      isPublic: false,
      sharedWith: [],
      pending: false,
      onClose,
      onApply,
      ...overrides,
    },
  })
  return { ...rendered, onClose, onApply }
}

// The overlay dismiss button shares the dialog close button's accessible
// name; select the dialog's own close affordance, never the overlay.
function getDialogCloseButton(queries: { getAllByLabelText: (label: string) => HTMLElement[] }) {
  const buttons = queries
    .getAllByLabelText('Close dialog')
    .filter(button => !button.hasAttribute('data-testid'))
  return buttons[buttons.length - 1]
}

describe('ShareDialog', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
    mockedSearchUsers.mockReset()
    mockedFetchRecentSharees.mockReset()
    mockedSearchUsers.mockResolvedValue([])
    mockedFetchRecentSharees.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps OK disabled until a change is made', () => {
    const { getByText } = renderDialog()

    expect((getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls onApply with the edited access state', () => {
    const onApply = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onApply })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getByText('OK'))

    expect(onApply).toHaveBeenCalledWith({ isPublic: true, sharedWith: [] })
  })

  it('closes immediately when dismissed without changes', () => {
    const onClose = vi.fn()
    const queries = renderDialog({ onClose })
    const { queryByText } = queries

    fireEvent.click(getDialogCloseButton(queries))

    expect(onClose).toHaveBeenCalled()
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })

  it('prompts to discard when dismissed with unsaved changes', () => {
    const onClose = vi.fn()
    const queries = renderDialog({ onClose })
    const { getByLabelText, getByText } = queries

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getDialogCloseButton(queries))

    expect(getByText('Discard unsaved changes?')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after confirming the discard', () => {
    const onClose = vi.fn()
    const queries = renderDialog({ onClose })
    const { getByLabelText, getByText } = queries

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getDialogCloseButton(queries))
    fireEvent.click(getByText('Discard'))

    expect(onClose).toHaveBeenCalled()
  })

  it('discards when the discard confirm is dismissed', () => {
    const onClose = vi.fn()
    const queries = renderDialog({ onClose })
    const { getByLabelText, queryByText } = queries

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getDialogCloseButton(queries))

    fireEvent.click(getDialogCloseButton(queries))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })

  it('seeds suggestions with previously shared users for a normal user', async () => {
    mockedFetchRecentSharees.mockResolvedValue([
      { id: 2, username: 'bob', email: 'bob@example.com' },
    ])
    const { findByText } = renderDialog()

    expect(await findByText('bob')).toBeTruthy()
    expect(mockedSearchUsers).not.toHaveBeenCalled()
  })

  it('filters previously shared suggestions while typing for a normal user', async () => {
    mockedFetchRecentSharees.mockResolvedValue([
      { id: 2, username: 'bob', email: 'bob@example.com' },
      { id: 3, username: 'carol', email: 'carol@example.com' },
    ])
    const { getByLabelText, findByText, queryByText } = renderDialog()
    await findByText('bob')

    fireEvent.input(getByLabelText('Shared with'), { target: { value: 'ca' } })

    expect(await findByText('carol')).toBeTruthy()
    expect(queryByText('bob')).toBeNull()
    expect(mockedSearchUsers).not.toHaveBeenCalled()
  })

  it('searches all users while typing for an admin', async () => {
    vi.useFakeTimers()
    mockedSearchUsers.mockResolvedValue([
      { id: 2, username: 'bob', email: 'bob@example.com' },
    ])
    const { getByLabelText, queryByText } = renderDialog({ isAdmin: true })

    fireEvent.input(getByLabelText('Shared with'), { target: { value: 'bo' } })
    expect(mockedSearchUsers).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(mockedSearchUsers).toHaveBeenCalledWith('bo')
    expect(queryByText('bob')).toBeTruthy()
  })

  it('gives each shared user chip a color derived from the username', () => {
    const { getAllByText } = renderDialog({
      sharedWith: [
        { id: 2, username: 'bob', email: 'bob@example.com' },
        { id: 3, username: 'carol', email: 'carol@example.com' },
      ],
    })

    const toRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
    }
    const bobColor = getDefaultTagColor('bob')
    const carolColor = getDefaultTagColor('carol')

    expect(bobColor).not.toBe(carolColor)
    expect((getAllByText('bob')[0] as HTMLElement).style.color).toBe(toRgb(bobColor))
    expect((getAllByText('carol')[0] as HTMLElement).style.color).toBe(toRgb(carolColor))
  })
})
