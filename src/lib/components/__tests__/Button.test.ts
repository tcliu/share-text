// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Button from '../Button.svelte'

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
