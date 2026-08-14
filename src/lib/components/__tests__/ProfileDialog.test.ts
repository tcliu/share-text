// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ProfileDialog from '../ProfileDialog.svelte'

const user = { id: 1, username: 'alice', email: 'alice@example.com' }

describe('ProfileDialog', () => {
  it('renders the username and email', async () => {
    const { getByText } = render(ProfileDialog, { props: { user, onClose: vi.fn() } })

    await waitFor(() => {
      expect(getByText('alice')).toBeTruthy()
      expect(getByText('alice@example.com')).toBeTruthy()
    })
  })

  it('calls onClose when the dialog close button is clicked', async () => {
    const onClose = vi.fn()
    const { getByLabelText } = render(ProfileDialog, { props: { user, onClose } })

    await waitFor(() => {
      fireEvent.click(getByLabelText('Close dialog'))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
