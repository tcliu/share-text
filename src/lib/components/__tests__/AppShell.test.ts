// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import AppShell from '../AppShell.svelte'

describe('AppShell floating drawer', () => {
  it('closes the drawer when the backdrop is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole, queryByRole } = render(AppShell, {
      mode: 'floating',
      open: true,
      onOpenChange,
    })

    const backdrop = getByRole('button', { name: 'Close pane' })
    await fireEvent.click(backdrop)

    await waitFor(() => {
      expect(queryByRole('button', { name: 'Close pane' })).toBeNull()
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes the drawer on Escape', async () => {
    const onOpenChange = vi.fn()
    const { getByRole, queryByRole } = render(AppShell, {
      mode: 'floating',
      open: true,
      leftPaneLabel: 'Documents',
      onOpenChange,
    })

    expect(getByRole('button', { name: 'Close pane' })).toBeTruthy()
    await fireEvent.keyDown(getByRole('complementary', { name: 'Documents' }), { key: 'Escape' })

    await waitFor(() => {
      expect(queryByRole('button', { name: 'Close pane' })).toBeNull()
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps focus on the main column when closed via the backdrop', async () => {
    const { getByRole, queryByRole, container } = render(AppShell, {
      mode: 'floating',
      open: true,
      leftPaneLabel: 'Documents',
    })

    const backdrop = getByRole('button', { name: 'Close pane' })
    const main = container.querySelector('main') as HTMLElement
    main.focus()

    // A real browser focuses a tabindex="-1" button on pointerdown unless the
    // handler prevents it; emulate that so the test fails if the backdrop is
    // allowed to take focus and then unmount (which drops focus to <body>).
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    backdrop.dispatchEvent(pointerDown)
    if (!pointerDown.defaultPrevented) backdrop.focus()

    await fireEvent.click(backdrop)

    await waitFor(() => {
      expect(queryByRole('button', { name: 'Close pane' })).toBeNull()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(main)
    })
  })
})

describe('AppShell docked pane', () => {
  it('renders the splitter and no backdrop', () => {
    const { getByRole, queryByRole } = render(AppShell, { open: true })

    expect(getByRole('separator', { name: 'Resize pane' })).toBeTruthy()
    expect(queryByRole('button', { name: 'Close pane' })).toBeNull()
  })
})

describe('AppShell first-paint guard', () => {
  it('marks the shell measured once the container is observed', async () => {
    const { container } = render(AppShell, { mode: 'auto', open: true })

    await waitFor(() => {
      expect(container.querySelector('[data-shell-measured]')?.getAttribute('data-shell-measured')).toBe('true')
    })
  })

  it('omits the guard for a pinned presentation', () => {
    const { container } = render(AppShell, { mode: 'docked', open: true })

    expect(container.querySelector('[data-shell-measured]')).toBeNull()
  })
})
