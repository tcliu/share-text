import { describe, expect, it } from 'vitest'
import { createGridCellRefs } from '../grid-cell-refs'

describe('createGridCellRefs', () => {
  it('registers each node under its row/column key', () => {
    const refs = createGridCellRefs()
    const box = document.createElement('td')
    const input = document.createElement('textarea')

    refs.cellBoxRef(box, { ri: 1, ci: 2 })
    refs.cellInputRef(input, { ri: 1, ci: 2 })

    expect(refs.cellBox(1, 2)).toBe(box)
    expect(refs.cellInput(1, 2)).toBe(input)
    // Keys are per-axis: a swapped pair resolves to nothing.
    expect(refs.cellBox(2, 1)).toBeNull()
  })

  it('re-keys a node when its params change', () => {
    const refs = createGridCellRefs()
    const box = document.createElement('td')
    const handle = refs.cellBoxRef(box, { ri: 1, ci: 0 }) as {
      update: (p: { ri: number; ci: number }) => void
      destroy: () => void
    }

    handle.update({ ri: 2, ci: 0 })

    expect(refs.cellBox(1, 0)).toBeNull()
    expect(refs.cellBox(2, 0)).toBe(box)

    handle.destroy()
    expect(refs.cellBox(2, 0)).toBeNull()
  })

  it('keeps a newer node when a re-keyed instance is destroyed', () => {
    const refs = createGridCellRefs()
    const first = document.createElement('th')
    const second = document.createElement('th')
    const stale = refs.rowSelectorRef(first, { ri: 0 }) as { destroy: () => void }

    refs.rowSelectorRef(second, { ri: 0 })
    stale.destroy()

    expect(refs.rowSelector(0)).toBe(second)
  })

  it('re-keys the column selector across a column insert', () => {
    const refs = createGridCellRefs()
    const header = document.createElement('th')
    const handle = refs.colSelectorRef(header, { ci: 1 }) as { update: (p: { ci: number }) => void }

    handle.update({ ci: 2 })

    expect(refs.colSelector(1)).toBeNull()
    expect(refs.colSelector(2)).toBe(header)
  })
})
