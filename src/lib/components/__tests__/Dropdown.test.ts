// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DropdownHost from './DropdownHost.svelte'

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})

async function physicalClick(el: Element) {
  await fireEvent.pointerDown(el)
  await fireEvent.focus(el)
  await fireEvent.mouseDown(el)
  await fireEvent.pointerUp(el)
  await fireEvent.mouseUp(el)
  await fireEvent.click(el)
}

function panelOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="listbox"]')).some(panel =>
    (panel.getAttribute('style') ?? '').includes('visibility: visible'),
  )
}

describe('filterable SelectDropdown', () => {
  it('selects an option by mouse and shows the label in the input', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    expect(document.querySelectorAll('[role="option"]').length).toBe(2)

    await fireEvent.input(input, { target: { value: '' } })

    const htmlOption = document.querySelector(
      '[role="option"][id$="-option-1"]',
    ) as HTMLElement
    await physicalClick(htmlOption)

    expect(input.value).toBe('HTML')
    expect(panelOpen()).toBe(false)
  })

  it('selects the highlighted option with Enter and shows the label', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(input.value).toBe('HTML')
    expect(panelOpen()).toBe(false)
  })

  it('reopens when the input gains focus again after selecting', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    const htmlOption = document.querySelector(
      '[role="option"][id$="-option-1"]',
    ) as HTMLElement
    await physicalClick(htmlOption)
    expect(input.value).toBe('HTML')
    expect(panelOpen()).toBe(false)

    await fireEvent.focus(input)
    expect(panelOpen()).toBe(true)
  })
})
