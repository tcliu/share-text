// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DropdownHost from './DropdownHost.svelte'
import SelectDropdown from '../SelectDropdown.svelte'

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
    expect(document.activeElement).toBe(input)
  })

  it('does not reopen on Enter keyup after selecting with Enter', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await fireEvent.keyUp(input, { key: 'Enter' })

    expect(input.value).toBe('HTML')
    expect(document.activeElement).toBe(input)
    expect(panelOpen()).toBe(false)
  })

  it('does nothing on Enter when the panel is closed', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('Markdown')
    expect(panelOpen()).toBe(false)

    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('Markdown')
    expect(panelOpen()).toBe(false)
  })

  it('reopens with a click after confirming with Enter', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(panelOpen()).toBe(false)

    await physicalClick(input)
    expect(panelOpen()).toBe(true)
  })

  it('reopens with ArrowDown after confirming with Enter and navigates', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(panelOpen()).toBe(false)

    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(panelOpen()).toBe(true)
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-1$/)
  })

  it('uses one shared highlight for mouse hover and keyboard navigation', async () => {
    const { getByRole } = render(DropdownHost)
    const input = getByRole('combobox') as HTMLInputElement
    await fireEvent.focus(input)

    const markdownOption = document.querySelector(
      '[role="option"][id$="-option-0"]',
    ) as HTMLElement
    const htmlOption = document.querySelector('[role="option"][id$="-option-1"]') as HTMLElement

    await fireEvent.mouseEnter(htmlOption)
    expect(input.getAttribute('aria-activedescendant')).toBe(htmlOption.id)

    await fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toBe(markdownOption.id)
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

  it('opens the non-filterable button dropdown with ArrowDown and navigates', async () => {
    const { getByRole } = render(SelectDropdown, {
      props: {
        buttonLabel: 'Markdown',
        options: [
          { value: 'markdown', label: 'Markdown' },
          { value: 'html', label: 'HTML' },
        ],
        activeValue: 'markdown',
        onSelect: () => {},
      },
    })
    const button = getByRole('combobox') as HTMLElement
    await fireEvent.keyDown(button, { key: 'ArrowDown' })
    expect(panelOpen()).toBe(true)
    expect(button.getAttribute('aria-activedescendant')).toMatch(/-option-0$/)

    await fireEvent.keyDown(button, { key: 'ArrowDown' })
    expect(button.getAttribute('aria-activedescendant')).toMatch(/-option-1$/)
  })
})
