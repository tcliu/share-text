// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Button from '../Button.svelte'
import { setTipBox, tipState } from '../../actions/tooltip.svelte'

describe('Button dataTip shared engine', () => {
  afterEach(() => {
    setTipBox(null)
    document.body.innerHTML = ''
  })

  function registerHost(): void {
    // The `#tip` host lives in the route layout; here a bare node stands in
    // for it. The action only publishes to `tipState` (nothing writes to the
    // DOM directly), so assertions read the published state the route renders.
    const host = document.createElement('div')
    document.body.appendChild(host)
    setTipBox(host)
  }

  it('publishes the dataTip text on hover and hides on leave', async () => {
    registerHost()
    const { getByRole, unmount } = render(Button, { ariaLabel: 'Info', dataTip: 'More info' })
    const button = getByRole('button', { name: 'Info' })

    await fireEvent.pointerEnter(button)
    expect(tipState.visible).toBe(true)
    expect(tipState.text).toBe('More info')

    await fireEvent.pointerLeave(button)
    expect(tipState.visible).toBe(false)
    unmount()
  })

  it('publishes on keyboard focus and hides on blur', async () => {
    registerHost()
    const { getByRole, unmount } = render(Button, { ariaLabel: 'Info', dataTip: 'Focused hint' })
    const button = getByRole('button', { name: 'Info' })

    await fireEvent.focus(button)
    expect(tipState.visible).toBe(true)
    expect(tipState.text).toBe('Focused hint')

    await fireEvent.blur(button)
    expect(tipState.visible).toBe(false)
    unmount()
  })

  it('moves the tip to the wrapper and off the disabled button', () => {
    const { getByRole, unmount } = render(Button, { ariaLabel: 'Info', dataTip: 'Disabled hint', disabled: true })
    const button = getByRole('button', { name: 'Info' }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    expect(button.hasAttribute('data-tip')).toBe(false)
    expect(button.parentElement?.getAttribute('data-tip')).toBe('Disabled hint')
    unmount()
  })
})
