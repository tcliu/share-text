// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import NumberInput from '../NumberInput.svelte'

function renderStepped() {
  render(NumberInput, { value: '5', min: 0, max: 10, ariaLabel: 'Quantity' })
  return screen.getByLabelText('Quantity') as HTMLInputElement
}

describe('NumberInput wheel stepping', () => {
  it('steps up on wheel while focused and keeps focus', async () => {
    const input = renderStepped()
    input.focus()
    await fireEvent.wheel(input, { deltaY: -100 })
    expect(input.value).toBe('6')
    expect(document.activeElement).toBe(input)
  })

  it('steps back down on wheel down', async () => {
    const input = renderStepped()
    input.focus()
    await fireEvent.wheel(input, { deltaY: -100 })
    await fireEvent.wheel(input, { deltaY: 100 })
    expect(input.value).toBe('5')
  })

  it('ignores the wheel while blurred so the page scrolls instead', async () => {
    const input = renderStepped()
    input.focus()
    input.blur()
    await fireEvent.wheel(input, { deltaY: -100 })
    expect(input.value).toBe('5')
  })

  it('labels the steppers without a provider and keeps them out of the tab order', () => {
    renderStepped()
    const increment = screen.getByRole('button', { name: 'Increment' })
    const decrement = screen.getByRole('button', { name: 'Decrement' })
    expect(increment.getAttribute('tabindex')).toBe('-1')
    expect(decrement.getAttribute('tabindex')).toBe('-1')
  })
})
