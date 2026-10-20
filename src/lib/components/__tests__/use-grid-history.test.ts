import { describe, expect, it } from 'vitest'
import { createGridHistory, type HistoryState } from '../use-grid-history.svelte'

describe('createGridHistory', () => {
  it('moves snapshots between the undo and redo stacks', () => {
    const history = createGridHistory()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)

    history.push([['a']])
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    // Undo returns the previous snapshot and parks the current one for redo.
    expect(history.undo([['b']])).toEqual([['a']])
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)

    // Redo returns the parked snapshot and restores the undo stack.
    expect(history.redo([['a']])).toEqual([['b']])
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('returns null when there is nothing to undo or redo', () => {
    const history = createGridHistory()
    expect(history.undo([['a']])).toBeNull()
    expect(history.redo([['a']])).toBeNull()
  })

  it('ignores a push identical to the top of the undo stack', () => {
    const history = createGridHistory()
    history.push([['a']])
    history.push([['a']])

    // A single undo consumes the only distinct snapshot.
    expect(history.undo([['b']])).toEqual([['a']])
    expect(history.canUndo).toBe(false)
  })

  it('snapshots the pushed matrix so later mutation cannot leak in', () => {
    const history = createGridHistory()
    const matrix = [['a']]
    history.push(matrix)
    matrix[0][0] = 'mutated'

    expect(history.undo([['b']])).toEqual([['a']])
  })

  it('drops the oldest snapshots past the history cap', () => {
    const history = createGridHistory()
    for (let index = 0; index < 120; index += 1) {
      history.push([[String(index)]])
    }

    let undos = 0
    while (history.undo([['x']])) undos += 1
    expect(undos).toBe(100)
  })

  it('notifies listeners on subscribe, push, and reset, and unsubscribes', () => {
    const history = createGridHistory()
    const seen: HistoryState[] = []
    const off = history.onChange(state => seen.push(state))
    expect(seen).toEqual([{ canUndo: false, canRedo: false }])

    history.push([['a']])
    expect(seen.at(-1)).toEqual({ canUndo: true, canRedo: false })

    // Undo/redo hand snapshots back but leave notifying to the caller's emit().
    history.undo([['b']])
    history.emit()
    expect(seen.at(-1)).toEqual({ canUndo: false, canRedo: true })

    off()
    history.reset()
    expect(seen).toHaveLength(3)
  })

  it('clears both stacks on reset', () => {
    const history = createGridHistory()
    history.push([['a']])
    history.undo([['b']])
    expect(history.canRedo).toBe(true)

    history.reset()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
