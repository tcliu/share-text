import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'

describe('ConfirmDialog', () => {
  it('calls onConfirm when OK clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(ConfirmDialog, {
      title: 'Discard unsaved changes?',
      message: 'msg',
      confirmLabel: 'OK',
      onConfirm,
      onCancel,
    })
    const ok = screen.getByRole('button', { name: 'OK' })
    await fireEvent.click(ok)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when overlay clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(ConfirmDialog, {
      title: 'Discard unsaved changes?',
      message: 'msg',
      confirmLabel: 'OK',
      onConfirm,
      onCancel,
    })
    const overlay = screen.getByTestId('dialog-overlay')
    await fireEvent.click(overlay)
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // ui-patterns.md says "the confirm's own dismiss affordances confirm the
  // discard"; share-text instead wires every dismiss affordance to onCancel,
  // which only closes the confirm and returns to the form. These assert the
  // observed behavior so the conflict is visible rather than silent.
  it('calls onCancel (returns to the form) when Escape is pressed, not onConfirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(ConfirmDialog, {
      title: 'Discard unsaved changes?',
      message: 'msg',
      confirmLabel: 'OK',
      onConfirm,
      onCancel,
    })
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel (returns to the form) when the close button is clicked, not onConfirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(ConfirmDialog, {
      title: 'Discard unsaved changes?',
      message: 'msg',
      confirmLabel: 'OK',
      onConfirm,
      onCancel,
    })
    const closeButton = screen.getByRole('dialog').querySelector('button[aria-label="Close dialog"]')
    expect(closeButton).toBeTruthy()
    await fireEvent.click(closeButton as HTMLButtonElement)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
