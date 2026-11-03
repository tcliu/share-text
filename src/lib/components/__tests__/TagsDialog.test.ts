// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import TagsDialog from '../TagsDialog.svelte'
import type { Tag } from '#lib/tag-colors.js'

const tags: Tag[] = [
  { name: 'alpha', color: '#00F0FF' },
  { name: 'beta', color: '#FF6680' },
]
const availableTags: Tag[] = [
  { name: 'alpha', color: '#00F0FF' },
  { name: 'gamma', color: '#00FF99' },
]

function renderDialog(overrides: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  const queries = render(TagsDialog, {
    props: { open: true, tags, availableTags, onSave, onClose, ...overrides },
  })
  return { ...queries, onSave, onClose }
}

describe('TagsDialog', () => {
  it('renders the persisted tags in their assigned colour', () => {
    const { getByRole, getByText } = renderDialog()
    const alpha = getByText('alpha')
    expect(alpha).toBeTruthy()
    // The shared TagInput owns the chip markup; the colour comes from the
    // per-tag style the dialog passes.
    expect(alpha.style.color).toBe('rgb(0, 240, 255)')
    expect(alpha.className).toContain('rounded-md')
    expect(getByRole('button', { name: 'Remove alpha' })).toBeTruthy()
    expect(getByText('beta')).toBeTruthy()
  })

  it('maps an added tag back to { name, color } using the available color', async () => {
    const { getByRole, onSave } = renderDialog()
    const input = getByRole('combobox')

    await fireEvent.input(input, { target: { value: 'gamma' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await fireEvent.click(getByRole('button', { name: 'OK' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Tag[]
    expect(saved.map(tag => tag.name)).toEqual(['alpha', 'beta', 'gamma'])
    expect(saved.find(tag => tag.name === 'gamma')?.color).toBe('#00FF99')
  })

  it('discards the draft when the discard confirm is dismissed', async () => {
    const { getByRole, getByText, onClose } = renderDialog()
    const input = getByRole('combobox')

    await fireEvent.input(input, { target: { value: 'gamma' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    // Dismissing the base dialog with a dirty draft opens the discard confirm.
    const dialogs = document.querySelectorAll('[role="dialog"]')
    const closeButton = dialogs[0].querySelector('button[aria-label="Close dialog"]') as HTMLButtonElement
    await fireEvent.click(closeButton)
    expect(getByText('Discard unsaved changes?')).toBeTruthy()

    // The confirm's own dismissal performs the discard.
    const stacked = document.querySelectorAll('[role="dialog"]')
    const confirmClose = stacked[stacked.length - 1].querySelector(
      'button[aria-label="Close dialog"]',
    ) as HTMLButtonElement
    await fireEvent.click(confirmClose)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
