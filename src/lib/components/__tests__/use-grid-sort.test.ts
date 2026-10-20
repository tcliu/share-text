import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Harness from './grid-sort.harness.svelte'

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

function render(rows: string[][], headers = true): void {
  instance = mount(Harness, { target, props: { rows, headers } })
  flushSync()
}

function click(name: string): void {
  const button = [...target.querySelectorAll('button')].find(b => b.textContent === name)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`button ${name} not found`)
  button.click()
  flushSync()
}

function state(): string {
  return target.querySelector('[data-testid="sort-state"]')?.textContent ?? ''
}

function matrix(): string[][] {
  return JSON.parse(target.querySelector('[data-testid="matrix"]')?.textContent ?? '[]')
}

describe('createGridSort', () => {
  it('sorts the data rows ascending and pins the header row', () => {
    render([
      ['Name', 'Qty'],
      ['Beta', '2'],
      ['Alpha', '1'],
    ])
    expect(state()).toBe('none:asc')

    click('sort-asc')
    expect(state()).toBe('0:asc')
    expect(matrix()).toEqual([
      ['Name', 'Qty'],
      ['Alpha', '1'],
      ['Beta', '2'],
    ])
  })

  it('flips the order for a descending sort', () => {
    render([
      ['Name'],
      ['Beta'],
      ['Alpha'],
    ])
    click('sort-desc')
    expect(state()).toBe('0:desc')
    expect(matrix()).toEqual([['Name'], ['Beta'], ['Alpha']])
  })

  it('sorts every row when headers are off', () => {
    render([['b'], ['a']], false)
    click('sort-asc')
    expect(matrix()).toEqual([['a'], ['b']])
  })

  it('clears the active sort once the sorted column changes', () => {
    render([
      ['Name', 'Qty'],
      ['Beta', '2'],
      ['Alpha', '1'],
    ])
    click('sort-asc')
    expect(state()).toBe('0:asc')

    // Editing a cell in the sorted column invalidates the indicator.
    click('edit-cell')
    expect(state()).toBe('none:asc')
  })
})
