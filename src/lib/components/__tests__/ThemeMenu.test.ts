// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import ThemeMenuTestHost from './ThemeMenuTestHost.svelte'
import { useTheme } from '$lib/use-theme.svelte'

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})

beforeEach(() => {
  localStorage.clear()
  useTheme().setTheme('dark')
})

function menuOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="menu"]')).some(panel =>
    (panel.getAttribute('style') ?? '').includes('visibility: visible'),
  )
}

describe('ThemeMenu', () => {
  it('opens with ArrowDown on the closed trigger and focuses the first item', async () => {
    const { getByRole } = render(ThemeMenuTestHost)
    const trigger = getByRole('button', { name: 'Theme' })

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(menuOpen()).toBe(true)
    expect(document.activeElement).toBe(getByRole('menuitemradio', { name: 'Dark' }))
  })

  it('selecting a theme applies it to the document, persists it, and moves aria-checked', async () => {
    const { getByRole } = render(ThemeMenuTestHost)
    const trigger = getByRole('button', { name: 'Theme' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await fireEvent.click(getByRole('menuitemradio', { name: 'Light' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('share-text:theme')).toBe('light')
    expect(menuOpen()).toBe(false)

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
    expect(getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('false')
  })

  it('selecting the dark theme removes the data-theme override', async () => {
    useTheme().setTheme('forest')
    const { getByRole } = render(ThemeMenuTestHost)
    expect(document.documentElement.dataset.theme).toBe('forest')

    await fireEvent.keyDown(getByRole('button', { name: 'Theme' }), { key: 'ArrowDown' })
    await fireEvent.click(getByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('share-text:theme')).toBe('dark')
  })
})
