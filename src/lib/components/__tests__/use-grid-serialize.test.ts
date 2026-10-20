import { describe, expect, it } from 'vitest'
import { createGridSerialize } from '../use-grid-serialize.svelte'
import type { GridRow } from '../use-grid-model.svelte'

let nextId = 0

function row(values: string[], committed = true): GridRow {
  return {
    id: nextId++,
    cells: values.map(value => ({ id: nextId++, value, committed })),
  }
}

function serialize(rows: GridRow[], opts: { headers?: boolean; maxColumns?: number } = {}) {
  const columnCount = Math.max(0, ...rows.map(r => r.cells.length))
  return createGridSerialize({
    getRows: () => rows,
    getColumnCount: () => columnCount,
    getHeaders: () => opts.headers ?? true,
    maxColumns: opts.maxColumns,
  })
}

describe('createGridSerialize', () => {
  it('bounds the committed matrix to the last authored row and column', () => {
    const rows = [row(['A', 'B'], true), row(['1', '2'], true), row(['', ''], false)]
    const api = serialize(rows)
    expect(api.committedMatrix()).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ])
    // The navigation-appended row is trimmable.
    expect(api.needsTrim).toBe(true)
  })

  it('keeps the header row even when no data row is authored', () => {
    const api = serialize([row(['A', 'B'])])
    expect(api.committedMatrix()).toEqual([['A', 'B']])
    expect(api.needsTrim).toBe(false)
  })

  it('drops trailing columns that were never committed', () => {
    const rows = [row(['A', 'x'], true), row(['1', 'y'], true)]
    rows[0].cells[1].committed = false
    rows[1].cells[1].committed = false
    const api = serialize(rows)
    expect(api.committedMatrix()).toEqual([['A'], ['1']])
    expect(api.needsTrim).toBe(true)
  })

  it('ignores trailing uncommitted columns when columns are capped', () => {
    const rows = [row(['A', ''], true)]
    rows[0].cells[1].committed = false
    const api = serialize(rows, { maxColumns: 3 })
    expect(api.needsTrim).toBe(false)
  })

  it('reports no trim for a fully authored matrix', () => {
    const api = serialize([row(['A', 'B']), row(['1', '2'])])
    expect(api.needsTrim).toBe(false)
  })

  it('finds the last row holding data, falling back to the header floor', () => {
    const last = serialize([row(['H']), row(['1']), row(['']), row([''])])
    expect(last.findLastRowWithData()).toBe(1)

    const headerOnly = serialize([row(['H']), row([''])])
    expect(headerOnly.findLastRowWithData()).toBe(0)

    const empty = serialize([row([''])], { headers: false })
    expect(empty.findLastRowWithData()).toBe(-1)
  })

  it('strips trailing all-empty rows, treating whitespace as empty', () => {
    const api = serialize([row(['A'])])
    expect(api.stripTrailingEmptyRows([['a'], [''], ['  ']])).toEqual([['a']])
    expect(api.stripTrailingEmptyRows([['a']])).toEqual([['a']])
  })
})
