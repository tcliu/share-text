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
})
