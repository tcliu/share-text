import { flushSync, mount, tick, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import Harness from './grid-editor.harness.svelte'

// The in-cell editing controller: which cell is being edited, the pre-edit
// snapshot Escape restores, and the key/paste handling that moves the caret
// between cells.

let target: HTMLDivElement
let instance: ReturnType<typeof mount> | null = null

beforeEach(() => {
  target = document.createElement('div')
  document.body.appendChild(target)
})

afterEach(async () => {
  if (instance) {
    await unmount(instance)
    instance = null
  }
  target.remove()
})

function mountEditor(rows: string[][]) {
  instance = mount(Harness, { target, props: { rows } })
  flushSync()
  return {
    cell: target.querySelector('[data-testid="cell"]') as HTMLTextAreaElement,
    values: () => JSON.parse(target.querySelector('[data-testid="values"]')!.textContent ?? '[]') as string[][],
    focusCalls: () => (target.querySelector('[data-testid="focus-calls"]')!.textContent ?? '').trim(),
    editing: () => target.querySelector('[data-testid="editing"]')!.textContent,
    click: (testId: string) => (target.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click(),
  }
}

async function key(cell: HTMLTextAreaElement, keyName: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...options })
  cell.dispatchEvent(event)
  flushSync()
  // The controller moves focus after a tick (it waits for the editor to blur).
  await tick()
  flushSync()
  return event
}

describe('grid editor', () => {
  it('marks the focused cell as the edited one', async () => {
    const editor = mountEditor([['a', 'b']])
    editor.cell.focus()
    flushSync()
    expect(editor.editing()).toBe('editing')
  })

  it('moves to the next column on Tab and prevents the default', async () => {
    const editor = mountEditor([['a', 'b']])
    const event = await key(editor.cell, 'Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(editor.focusCalls()).toContain('cellInput:0:1')
  })

  it('moves to the next row on Tab from the last column', async () => {
    const editor = mountEditor([['a', 'b'], ['c', 'd']])
    await key(editor.cell, 'Tab')
    await key(editor.cell, 'Tab')
    expect(editor.focusCalls()).toContain('cellInput:1:0')
  })

  it('leaves the grid on Tab from the last cell instead of trapping focus', async () => {
    const editor = mountEditor([['a'], ['b']])
    await key(editor.cell, 'Tab')
    const last = await key(editor.cell, 'Tab')
    // The second Tab is the last cell: nothing follows it in the grid, so the
    // key is left alone and focus leaves the grid.
    expect(last.defaultPrevented).toBe(false)
  })

  it('commits and moves down on Enter', async () => {
    const editor = mountEditor([['a'], ['b']])
    const event = await key(editor.cell, 'Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(editor.focusCalls()).toContain('cellBox:1:0')
  })

  it('restores the pre-edit value on Escape', async () => {
    const editor = mountEditor([['original']])
    editor.cell.focus()
    flushSync()
    editor.click('set-value')
    flushSync()
    expect(editor.values()[0]?.[0]).toBe('typed')

    await key(editor.cell, 'Escape')
    flushSync()
    expect(editor.values()[0]?.[0]).toBe('original')
  })

  it('applies pasted text to the cell', async () => {
    const editor = mountEditor([['a']])
    editor.click('paste')
    flushSync()
    expect(editor.values()[0]?.[0]).toBe('pasted')
  })
})
