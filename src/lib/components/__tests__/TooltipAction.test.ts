// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Button from '../Button.svelte'
import { setTipBox, tipState, tooltip } from '../../actions/tooltip.svelte'

describe('tooltip engine and Button tooltip', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
    setTipBox(null)
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  function registerHost(): void {
    // The `#tip` host lives in the route layout; here a bare node stands in
    // for it. The action only publishes to `tipState` (nothing writes to the
    // DOM directly), so assertions read the published state the route renders.
    const host = document.createElement('div')
    document.body.appendChild(host)
    setTipBox(host)
  }

  function attachTip(text: string): HTMLElement {
    const node = document.createElement('span')
    node.dataset.tip = text
    document.body.appendChild(node)
    const action = tooltip(node)
    if (action) cleanups.push(() => action.destroy?.())
    return node
  }

  it('publishes the data-tip text on hover and hides on leave', async () => {
    registerHost()
    const node = attachTip('More info')

    await fireEvent.pointerEnter(node)
    expect(tipState.visible).toBe(true)
    expect(tipState.text).toBe('More info')

    await fireEvent.pointerLeave(node)
    expect(tipState.visible).toBe(false)
  })

  it('publishes on keyboard focus and hides on blur', async () => {
    registerHost()
    const node = attachTip('Focused hint')

    await fireEvent.focus(node)
    expect(tipState.visible).toBe(true)
    expect(tipState.text).toBe('Focused hint')

    await fireEvent.blur(node)
    expect(tipState.visible).toBe(false)
  })

  it('shows the Button tooltip on the wrapper when the button is disabled', () => {
    // A disabled button fires no mouse events, so the positioned Tooltip
    // rides the non-disabled wrapper span instead of the button itself.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const { getByRole } = render(Button, { ariaLabel: 'Info', tooltip: 'Disabled hint', disabled: true })
    const button = getByRole('button', { name: 'Info' }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    const trigger = button.parentElement!

    fireEvent.mouseEnter(trigger)
    expect(getByRole('tooltip').textContent).toBe('Disabled hint')
  })
})
