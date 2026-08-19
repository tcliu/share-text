// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import KebabMenu, { type KebabMenuItem } from '../KebabMenu.svelte'

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})

async function physicalClick(el: Element) {
  await fireEvent.pointerDown(el)
  await fireEvent.focus(el)
  await fireEvent.mouseDown(el)
  await fireEvent.pointerUp(el)
  await fireEvent.mouseUp(el)
  await fireEvent.click(el)
}

function menuOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="menu"]')).some(panel =>
    (panel.getAttribute('style') ?? '').includes('visibility: visible'),
  )
}

function makeItems(log: string[]): KebabMenuItem[] {
  return [
    { id: 'upload', label: 'Upload', onClick: () => log.push('upload') },
    { id: 'export', label: 'Export', onClick: () => log.push('export'), disabled: true },
    { id: 'history', label: 'History', onClick: () => log.push('history') },
  ]
}

describe('KebabMenu', () => {
  it('opens with ArrowDown on the closed trigger and focuses the first enabled item', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(menuOpen()).toBe(true)
    expect(getByRole('menuitem', { name: 'Upload' }).getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Upload' }))
  })

  it('navigates with arrows, skipping disabled items', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await fireEvent.keyDown(getByRole('menuitem', { name: 'Upload' }), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'History' }))

    await fireEvent.keyDown(getByRole('menuitem', { name: 'History' }), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Upload' }))
  })

  it('moves to the last item with End and the first with Home', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await fireEvent.keyDown(getByRole('menuitem', { name: 'Upload' }), { key: 'End' })
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'History' }))

    await fireEvent.keyDown(getByRole('menuitem', { name: 'History' }), { key: 'Home' })
    expect(document.activeElement).toBe(getByRole('menuitem', { name: 'Upload' }))
  })

  it('syncs the keyboard highlight when the mouse hovers an item', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const history = getByRole('menuitem', { name: 'History' })
    await fireEvent.mouseEnter(history)

    expect(history.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(history)
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(menuOpen()).toBe(true)

    await fireEvent.keyDown(getByRole('menuitem', { name: 'Upload' }), { key: 'Escape' })

    expect(menuOpen()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('does nothing when clicking a disabled item', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await physicalClick(getByRole('menuitem', { name: 'Export' }))

    expect(menuOpen()).toBe(true)
    expect(log).toEqual([])
  })

  it('selects an item, closes the menu, returns focus to the trigger, and runs the action', async () => {
    const log: string[] = []
    const { getByRole } = render(KebabMenu, { props: { items: makeItems(log) } })
    const trigger = getByRole('button', { name: 'More actions' })
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    await physicalClick(getByRole('menuitem', { name: 'History' }))

    expect(menuOpen()).toBe(false)
    expect(log).toEqual(['history'])
    expect(document.activeElement).toBe(trigger)
  })
})
