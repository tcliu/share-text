import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import Harness from './grid-columns.harness.svelte'

// The column-width engine: the auto layout that fills the container, the
// explicit widths (pixels or percentages) a caller asks for, and the
// reconciliation that keeps the widths aligned with the column count.

let target: HTMLDivElement
let instance: ReturnType<typeof mount> | null = null
let containerWidth = 400

beforeEach(() => {
  target = document.createElement('div')
  document.body.appendChild(target)
  // jsdom has no layout, so the container reports a fixed width.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => containerWidth,
  })
})

afterEach(async () => {
  if (instance) {
    await unmount(instance)
    instance = null
  }
  target.remove()
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
})

function mountColumns(props: { columnCount: number; initialColumnWidths?: string[] }) {
  instance = mount(Harness, { target, props })
  flushSync()
  return {
    widths: () => JSON.parse(target.querySelector('[data-testid="widths"]')!.textContent ?? '[]') as number[],
    managed: () => target.querySelector('[data-testid="managed"]')!.textContent,
    total: () => Number(target.querySelector('[data-testid="total"]')!.textContent),
    style: (index: number) => target.querySelector(`[data-testid="style-${index}"]`)!.textContent,
    click: (testId: string) => (target.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click(),
  }
}

describe('grid columns', () => {
  it('fills the container with equal auto widths', () => {
    const columns = mountColumns({ columnCount: 3 })
    expect(columns.managed()).toBe('auto')
    // The row-number column (36px) and the table border (1px) are not part of
    // the data columns; the last column absorbs the remainder.
    expect(columns.widths()).toEqual([121, 121, 121])
    expect(columns.total()).toBe(399)
  })

  it('resolves an explicit pixel width into a managed layout', () => {
    const columns = mountColumns({ columnCount: 2, initialColumnWidths: ['200px'] })
    expect(columns.managed()).toBe('managed')
    expect(columns.widths()[0]).toBe(200)
    expect(columns.style(0)).toContain('width:200px')
  })

  it('resolves a percentage width against the container', () => {
    const columns = mountColumns({ columnCount: 2, initialColumnWidths: ['50%'] })
    expect(columns.managed()).toBe('managed')
    // Half of the usable width (400 - 36 - 1 = 363) is 181.5, rounded to 182.
    expect(columns.widths()[0]).toBe(182)
  })

  it('keeps the widths aligned when a column is added', async () => {
    const columns = mountColumns({ columnCount: 2, initialColumnWidths: ['200px', '150px'] })
    expect(columns.widths()).toHaveLength(2)

    columns.click('add-column')
    flushSync()
    expect(columns.widths()).toHaveLength(3)
    // The new column gets the engine's default width, not a live measurement.
    expect(columns.widths()[2]).toBe(128)
  })
})
