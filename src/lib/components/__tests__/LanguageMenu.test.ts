// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LanguageMenuTestHost from './LanguageMenuTestHost.svelte'
import type { ShareTextI18n } from '$lib/i18n.svelte'

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})

let i18n: ShareTextI18n

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  i18n.setLocale('en')
})

function menuOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="menu"]')).some(panel =>
    (panel.getAttribute('style') ?? '').includes('visibility: visible'),
  )
}

describe('LanguageMenu', () => {
  it('opens with ArrowDown on the closed trigger and focuses the first item', async () => {
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(menuOpen()).toBe(true)
    expect(document.activeElement).toBe(getByRole('menuitemradio', { name: 'English' }))
  })

  it('navigates with arrows and Home/End', async () => {
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await fireEvent.keyDown(getByRole('menuitemradio', { name: 'English' }), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(getByRole('menuitemradio', { name: '简体中文' }))

    await fireEvent.keyDown(getByRole('menuitemradio', { name: '简体中文' }), { key: 'End' })
    expect(document.activeElement).toBe(getByRole('menuitemradio', { name: '繁體中文' }))

    await fireEvent.keyDown(getByRole('menuitemradio', { name: '繁體中文' }), { key: 'Home' })
    expect(document.activeElement).toBe(getByRole('menuitemradio', { name: 'English' }))
  })

  it('syncs the highlight when the mouse hovers an item', async () => {
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const traditional = getByRole('menuitemradio', { name: '繁體中文' })
    await fireEvent.mouseEnter(traditional)

    expect(document.activeElement).toBe(traditional)
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(menuOpen()).toBe(true)

    await fireEvent.keyDown(getByRole('menuitemradio', { name: 'English' }), { key: 'Escape' })

    expect(menuOpen()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('selecting a language moves aria-checked and updates the locale', async () => {
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const traditional = getByRole('menuitemradio', { name: '繁體中文' })
    await fireEvent.click(traditional)

    expect(i18n.locale).toBe('zh-TW')
    expect(menuOpen()).toBe(false)

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(getByRole('menuitemradio', { name: '繁體中文' }).getAttribute('aria-checked')).toBe('true')
    expect(getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked')).toBe('false')
  })
})
