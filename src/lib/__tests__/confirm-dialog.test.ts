import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'

// A discard confirm opts into `confirmOnDismiss`: Cancel from the confirm would
// return to the form, but the confirm's own dismiss affordances (Escape, overlay
// click, close button) perform the discard instead.
function renderDiscard() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(ConfirmDialog, {
    title: 'Discard unsaved changes?',
    message: 'msg',
    confirmLabel: 'OK',
    confirmOnDismiss: true,
    onConfirm,
    onCancel,
  })
  return { onConfirm, onCancel }
}

describe('ConfirmDialog discard semantics', () => {
  it('calls onConfirm when the confirm button is clicked', async () => {
    const { onConfirm, onCancel } = renderDiscard()
    await fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('performs the discard on Escape instead of returning to the form', async () => {
    const { onConfirm, onCancel } = renderDiscard()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('performs the discard on overlay click instead of returning to the form', async () => {
    const { onConfirm, onCancel } = renderDiscard()
    await fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('performs the discard on close-button click instead of returning to the form', async () => {
    const { onConfirm, onCancel } = renderDiscard()
    const closeButton = screen.getByRole('dialog').querySelector('button[aria-label="Close dialog"]')
    expect(closeButton).toBeTruthy()
    await fireEvent.click(closeButton as HTMLButtonElement)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog cancel semantics', () => {
  it('keeps the separate cancel affordance for non-discard confirms', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(ConfirmDialog, {
      title: 'Delete?',
      message: 'msg',
      confirmLabel: 'OK',
      onConfirm,
      onCancel,
    })
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
