// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import Button from '../Button.svelte'

describe('Tooltip', () => {
  beforeEach(() => {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows on hover over the button', () => {
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const button = getByRole('button', { name: 'Save' })
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    expect(queryByRole('tooltip')).toBeTruthy()
  })

  it('stays visible while the pointer remains over the button', () => {
    const { getByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const button = getByRole('button', { name: 'Save' })
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    button.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    expect(getByRole('tooltip')).toBeTruthy()
  })

  it('hides when the pointer leaves the button', async () => {
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const button = getByRole('button', { name: 'Save' })
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    expect(getByRole('tooltip')).toBeTruthy()

    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await vi.waitFor(() => expect(queryByRole('tooltip')).toBeNull())
  })

  it('does not show tooltips on touch-only devices (no hover support)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const button = getByRole('button', { name: 'Save' })
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    expect(queryByRole('tooltip')).toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Save')
  })
})