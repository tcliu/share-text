import { describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import { createGridSelectors, type GridSelectorsOptions } from '../use-grid-selectors.svelte'
import { createInitialSelectionState } from '../grid-selection-state'

type Model = GridSelectorsOptions['model']

function setup(options: { rows?: number; columns?: number; headers?: boolean; readOnly?: boolean } = {}) {
  const model = {
    rowCount: options.rows ?? 4,
    columnCount: options.columns ?? 3,
    headers: options.headers ?? true,
    pruneTrailingPendingRows: vi.fn(),
    pruneTrailingPendingColumns: vi.fn(),
  } as unknown as Model

  const focus = {
    cellBox: vi.fn(),
    cellInput: vi.fn(),
    cellInputAtEnd: vi.fn(),
    cellInputSelectAll: vi.fn(),
    startEdit: vi.fn(),
    rowSelector: vi.fn(),
    columnSelector: vi.fn(),
    isCellInputFocused: vi.fn(() => false),
  }

  const state = createInitialSelectionState()
  const handlers = {
    deleteSelectedRows: vi.fn(),
    deleteSelectedColumns: vi.fn(),
    appendPendingRowAndSelect: vi.fn(),
    addPendingColumnAndSelect: vi.fn(),
  }

  const selectors = createGridSelectors({
    model,
    focus,
    state,
    readOnly: () => options.readOnly ?? false,
    ...handlers,
  })
  return { selectors, model, focus, state, handlers }
}

function mouse(init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...init })
}

function key(key: string, shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
}

describe('createGridSelectors (rows)', () => {
  it('selects a single row on mousedown and prunes navigation-appended rows', () => {
    const { selectors, model, state } = setup()
    selectors.handleRowSelectorMousedown(mouse(), 2)

    expect(state.selectedRows).toEqual(new Set([2]))
    expect(state.rowAnchor).toBe(2)
    expect(state.rowDragStart).toBe(2)
    expect(state.selectedCell).toBeNull()
    expect(model.pruneTrailingPendingRows).toHaveBeenCalledWith(2)
  })

  it('extends the selection from the anchor on Shift+mousedown', () => {
    const { selectors, state } = setup()
    state.rowAnchor = 1
    selectors.handleRowSelectorMousedown(mouse({ shiftKey: true }), 3)

    expect(state.selectedRows).toEqual(new Set([1, 2, 3]))
    expect(state.rowDragStart).toBeNull()
  })

  it('toggles a row on Ctrl+mousedown without dropping the others', () => {
    const { selectors, state } = setup()
    state.selectedRows = new Set([0])
    selectors.handleRowSelectorMousedown(mouse({ ctrlKey: true }), 2)
    expect(state.selectedRows).toEqual(new Set([0, 2]))

    selectors.handleRowSelectorMousedown(mouse({ ctrlKey: true }), 0)
    expect(state.selectedRows).toEqual(new Set([2]))
  })

  it('drags a contiguous range from the drag start on mouseover', () => {
    const { selectors, state } = setup()
    selectors.handleRowSelectorMousedown(mouse(), 1)
    selectors.handleRowSelectorMouseOver(3)
    expect(state.selectedRows).toEqual(new Set([1, 2, 3]))
  })

  it('steps the selection with ArrowDown and focuses the next selector', () => {
    const { selectors, state, focus } = setup()
    state.selectedRows = new Set([0])
    state.rowAnchor = 0
    selectors.handleRowSelectorKeydown(key('ArrowDown'), 0)

    expect(state.selectedRows).toEqual(new Set([1]))
    expect(state.rowAnchor).toBe(1)
    expect(focus.rowSelector).toHaveBeenCalledWith(1)
  })

  it('hands focus to the first cell of the row on ArrowRight', () => {
    const { selectors, state, focus } = setup()
    state.selectedRows = new Set([2])
    selectors.handleRowSelectorKeydown(key('ArrowRight'), 2)

    expect(state.selectedCell).toEqual({ ri: 2, ci: 0 })
    expect(state.selectedRows.size).toBe(0)
    expect(focus.cellBox).toHaveBeenCalledWith(2, 0)
  })

  it('deletes the selected rows and refocuses the surviving selector', async () => {
    const { selectors, state, handlers, focus } = setup()
    state.selectedRows = new Set([1, 2])
    selectors.handleRowSelectorKeydown(key('Delete'), 1)

    expect(handlers.deleteSelectedRows).toHaveBeenCalledTimes(1)
    await tick()
    expect(focus.rowSelector).toHaveBeenCalledWith(1)
  })

  it('does not delete while read-only', () => {
    const { selectors, state, handlers } = setup({ readOnly: true })
    state.selectedRows = new Set([1])
    selectors.handleRowSelectorKeydown(key('Delete'), 1)
    expect(handlers.deleteSelectedRows).not.toHaveBeenCalled()
  })
})

describe('createGridSelectors (columns)', () => {
  it('selects a single column on mousedown', () => {
    const { selectors, model, state } = setup()
    selectors.handleColumnSelectorMousedown(mouse(), 1)
    expect(state.selectedCols).toEqual(new Set([1]))
    expect(state.colAnchor).toBe(1)
    expect(model.pruneTrailingPendingColumns).toHaveBeenCalledWith(1)
  })

  it('steps the selection with ArrowRight and focuses the next selector', () => {
    const { selectors, state, focus } = setup()
    state.selectedCols = new Set([0])
    selectors.handleColumnSelectorKeydown(key('ArrowRight'), 0)
    expect(state.selectedCols).toEqual(new Set([1]))
    expect(focus.columnSelector).toHaveBeenCalledWith(1)
  })

  it('hands focus to the first cell of the column on ArrowDown', () => {
    const { selectors, state, focus } = setup()
    state.selectedCols = new Set([1])
    selectors.handleColumnSelectorKeydown(key('ArrowDown'), 1)
    expect(state.selectedCell).toEqual({ ri: 0, ci: 1 })
    expect(focus.cellBox).toHaveBeenCalledWith(0, 1)
  })

  it('drags a contiguous column range on mouseover', () => {
    const { selectors, state } = setup()
    selectors.handleColumnSelectorMousedown(mouse(), 0)
    selectors.handleColumnSelectorMouseOver(2)
    expect(state.selectedCols).toEqual(new Set([0, 1, 2]))
  })
})
