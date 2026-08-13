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
    vi.useRealTimers()
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

  it('does not show hover tooltips on touch-only devices', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const button = getByRole('button', { name: 'Save' })
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    expect(queryByRole('tooltip')).toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Save')
  })

  it('shows a tooltip on long-press and dismisses it on touch-only devices', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const trigger = getByRole('button', { name: 'Save' }).parentElement!

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    expect(queryByRole('tooltip')).toBeNull()

    await vi.advanceTimersByTimeAsync(500)
    expect(queryByRole('tooltip')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(2000)
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('does not show a tooltip for a quick tap on touch-only devices', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const trigger = getByRole('button', { name: 'Save' }).parentElement!

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
    await vi.advanceTimersByTimeAsync(500)
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('re-tapping a visible long-press tooltip restarts its dismiss timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const { getByRole, queryByRole } = render(Button, { ariaLabel: 'Save', tooltip: 'Save' })
    const trigger = getByRole('button', { name: 'Save' }).parentElement!

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    await vi.advanceTimersByTimeAsync(500)
    expect(queryByRole('tooltip')).toBeTruthy()

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
    await vi.advanceTimersByTimeAsync(2000)
    expect(queryByRole('tooltip')).toBeNull()
  })
})