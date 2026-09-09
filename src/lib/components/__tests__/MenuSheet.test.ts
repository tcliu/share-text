// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageMenuTestHost from './LanguageMenuTestHost.svelte'
import type { ShareTextI18n } from '$lib/i18n.svelte'

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})

let i18n: ShareTextI18n

function stubViewport(phone: boolean) {
  // Layer on the vitest-setup baseline (hover capable, no reduced motion);
  // override only the phone-sheet query so Tooltip and transition behavior
  // under test stay identical to every other suite.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: String(query).includes('27.999rem') ? phone : query === '(hover: hover)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

beforeEach(() => {
  localStorage.clear()
  stubViewport(false)
})

describe('Menu phone sheet', () => {
  it('renders the anchored popover on desktop viewports', async () => {
    const { getByRole, queryByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })

    await fireEvent.keyDown(getByRole('button', { name: 'Language' }), { key: 'ArrowDown' })

    expect(getByRole('menu')).toBeTruthy()
    expect(queryByRole('dialog')).toBeNull()
  })

  it('renders the bottom sheet with title and close control on phone viewports', async () => {
    stubViewport(true)
    const { getByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })

    await fireEvent.keyDown(getByRole('button', { name: 'Language' }), { key: 'ArrowDown' })

    expect(getByRole('dialog')).toBeTruthy()
    expect(getByRole('heading', { name: 'Language' })).toBeTruthy()
    expect(getByRole('menuitemradio', { name: 'English' })).toBeTruthy()
  })

  it('closes the sheet with Escape and returns focus to the trigger', async () => {
    stubViewport(true)
    const { getByRole, queryByRole } = render(LanguageMenuTestHost, { props: { onReady: store => (i18n = store) } })
    const trigger = getByRole('button', { name: 'Language' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(getByRole('dialog')).toBeTruthy()

    await fireEvent.keyDown(getByRole('menuitemradio', { name: 'English' }), { key: 'Escape' })

    expect(queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
