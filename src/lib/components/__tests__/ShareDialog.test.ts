// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import type { ComponentProps } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import ShareDialog from '../ShareDialog.svelte'

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

describe('ShareDialog', () => {
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
    const { getByLabelText, queryByText } = renderDialog({ onClose })

    fireEvent.click(getByLabelText('Close dialog'))

    expect(onClose).toHaveBeenCalled()
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })

  it('prompts to discard when dismissed with unsaved changes', () => {
    const onClose = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onClose })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getByLabelText('Close dialog'))

    expect(getByText('Discard unsaved changes?')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after confirming the discard', () => {
    const onClose = vi.fn()
    const { getByLabelText, getByText } = renderDialog({ onClose })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getByLabelText('Close dialog'))
    fireEvent.click(getByText('Discard'))

    expect(onClose).toHaveBeenCalled()
  })

  it('returns to the form when cancelling the discard confirm', () => {
    const onClose = vi.fn()
    const { getAllByLabelText, getByLabelText, queryByText } = renderDialog({ onClose })

    fireEvent.click(getByLabelText('Anyone with the link can view'))
    fireEvent.click(getByLabelText('Close dialog'))

    const closeButtons = getAllByLabelText('Close dialog')
    fireEvent.click(closeButtons[closeButtons.length - 1])

    expect(onClose).not.toHaveBeenCalled()
    expect(queryByText('Discard unsaved changes?')).toBeNull()
  })
})
