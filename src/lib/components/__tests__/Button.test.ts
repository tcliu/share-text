// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Button from '@codepg/ui-lib/components/Button.svelte'

describe('Button menu trigger semantics', () => {
  it('forwards aria-haspopup, aria-controls, and aria-expanded', () => {
    const { getByRole } = render(Button, {
      ariaLabel: 'More actions',
      ariaHaspopup: 'menu',
      ariaControls: 'menu-1',
      ariaExpanded: true,
    })
    const button = getByRole('button', { name: 'More actions' })

    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-controls')).toBe('menu-1')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('omits the trigger attributes when unset', () => {
    const { getByRole } = render(Button, { ariaLabel: 'Toggle' })
    const button = getByRole('button', { name: 'Toggle' })

    expect(button.hasAttribute('aria-haspopup')).toBe(false)
    expect(button.hasAttribute('aria-controls')).toBe(false)
  })
})

describe('Button preventFocusSteal', () => {
  it('calls preventDefault on pointerdown so the button never takes focus', () => {
    const { getByRole } = render(Button, { ariaLabel: 'Toggle', preventFocusSteal: true })
    const button = getByRole('button', { name: 'Toggle' })

    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not prevent default on pointerdown by default', () => {
    const { getByRole } = render(Button, { ariaLabel: 'Toggle' })
    const button = getByRole('button', { name: 'Toggle' })

    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    button.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('still fires onClick when preventFocusSteal is set', async () => {
    const onClick = vi.fn()
    const { getByRole } = render(Button, { ariaLabel: 'Toggle', preventFocusSteal: true, onClick })
    const button = getByRole('button', { name: 'Toggle' })

    await fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
