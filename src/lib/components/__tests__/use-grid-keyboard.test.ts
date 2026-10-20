import { describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import { createGridKeyboard, type GridKeyboardOptions } from '../use-grid-keyboard.svelte'
import { createInitialSelectionState } from '../grid-selection-state'

type Model = GridKeyboardOptions['model']

interface KeyInit {
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  // When false the event's target and currentTarget differ (a bubbling event).
  ownTarget?: boolean
}

function keyEvent(key: string, init: KeyInit = {}): KeyboardEvent {
  const element = {} as EventTarget
  return {
    key,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    target: element,
    currentTarget: init.ownTarget === false ? ({} as EventTarget) : element,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

function setup(options: { readOnly?: boolean; headers?: boolean; rows?: number } = {}) {
  const model = {
    rows: Array.from({ length: options.rows ?? 3 }, (_, ri) => ({
      id: ri,
      cells: [0, 1, 2].map(ci => ({ id: ri * 10 + ci, value: '', committed: true })),
    })),
    rowCount: options.rows ?? 3,
    columnCount: 3,
    headers: options.headers ?? true,
    appendPendingRow: vi.fn(() => options.rows ?? 3),
    appendPendingColumn: vi.fn(() => 3),
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
  const commands = {
    applyRange: vi.fn(),
    selectAllCells: vi.fn(),
    clearSelectedCellValues: vi.fn(),
    deleteSelectedRows: vi.fn(),
    deleteSelectedColumns: vi.fn(),
    copySelection: vi.fn(),
    cutSelection: vi.fn(),
    pasteSelection: vi.fn(),
    setActiveCell: vi.fn(),
  }

  const state = createInitialSelectionState()
  const keyboard = createGridKeyboard({
    model,
    focus,
    state,
    readOnly: () => options.readOnly ?? false,
    ...commands,
  })
  return { keyboard, model, focus, state, commands }
}

describe('createGridKeyboard', () => {
  it('ignores keys that bubble up from a child element', () => {
    const { keyboard, focus, commands } = setup()
    keyboard.handleBoxKeydown(keyEvent('Enter', { ownTarget: false }), 0, 0)
    expect(commands.setActiveCell).not.toHaveBeenCalled()
    expect(focus.cellInput).not.toHaveBeenCalled()
  })

  it('routes Enter to editing and Escape back to the box', () => {
    const { keyboard, focus, commands } = setup()
    keyboard.handleBoxKeydown(keyEvent('Enter'), 1, 1)
    expect(commands.setActiveCell).toHaveBeenCalledWith(1, 1)
    expect(focus.cellInput).toHaveBeenCalledWith(1, 1)

    keyboard.handleBoxKeydown(keyEvent('Escape'), 1, 1)
    expect(focus.cellBox).toHaveBeenCalledWith(1, 1)
  })

  it('moves the selection with an arrow key and drops the row/column selection', () => {
    const { keyboard, focus, state } = setup()
    state.selectedRows = new Set([0])
    state.selectedCols = new Set([0])

    keyboard.handleBoxKeydown(keyEvent('ArrowRight'), 0, 0)
    expect(state.selectedCell).toEqual({ ri: 0, ci: 1 })
    expect(state.selectedRows.size).toBe(0)
    expect(state.selectedCols.size).toBe(0)
    expect(focus.cellBox).toHaveBeenCalledWith(0, 1)
  })

  it('extends the selection with Shift+Arrow through the range hook', async () => {
    const { keyboard, commands, state } = setup()
    state.selectionAnchor = { ri: 0, ci: 0 }

    keyboard.handleBoxKeydown(keyEvent('ArrowRight', { shiftKey: true }), 0, 1)
    expect(commands.applyRange).toHaveBeenCalledWith({ ri: 0, ci: 0 }, { ri: 0, ci: 2 })
    expect(state.selectedCell).toEqual({ ri: 0, ci: 2 })
    await tick()
  })

  it('appends a pending row on ArrowDown from the last row', async () => {
    const { keyboard, model, focus, state } = setup({ rows: 3 })
    keyboard.handleBoxKeydown(keyEvent('ArrowDown'), 2, 1)

    expect(model.appendPendingRow).toHaveBeenCalled()
    expect(state.selectedCell).toEqual({ ri: 3, ci: 1 })
    await tick()
    expect(focus.cellBox).toHaveBeenCalledWith(3, 1)
  })

  it('does not append a row from the last row while read-only', () => {
    const { keyboard, model, focus } = setup({ rows: 3, readOnly: true })
    keyboard.handleBoxKeydown(keyEvent('ArrowDown'), 2, 1)
    expect(model.appendPendingRow).not.toHaveBeenCalled()
    expect(focus.cellBox).not.toHaveBeenCalled()
  })

  it('hands focus to the row selector from the first column and the column selector from the first row', () => {
    const { keyboard, focus, state } = setup()
    keyboard.handleBoxKeydown(keyEvent('ArrowLeft'), 1, 0)
    expect(state.selectedRows).toEqual(new Set([1]))
    expect(focus.rowSelector).toHaveBeenCalledWith(1)

    keyboard.handleBoxKeydown(keyEvent('ArrowUp'), 0, 2)
    expect(state.selectedCols).toEqual(new Set([2]))
    expect(focus.columnSelector).toHaveBeenCalledWith(2)
  })

  it('routes clipboard shortcuts, honoring read-only for the mutating ones', () => {
    const { keyboard, commands } = setup()
    keyboard.handleBoxKeydown(keyEvent('c', { ctrlKey: true }), 0, 0)
    expect(commands.copySelection).toHaveBeenCalledTimes(1)
    keyboard.handleBoxKeydown(keyEvent('a', { ctrlKey: true }), 0, 0)
    expect(commands.selectAllCells).toHaveBeenCalledTimes(1)
    keyboard.handleBoxKeydown(keyEvent('v', { ctrlKey: true }), 0, 0)
    expect(commands.pasteSelection).toHaveBeenCalledTimes(1)

    const readOnly = setup({ readOnly: true })
    readOnly.keyboard.handleBoxKeydown(keyEvent('x', { metaKey: true }), 0, 0)
    expect(readOnly.commands.cutSelection).not.toHaveBeenCalled()
  })

  it('deletes the selected columns or rows before falling back to clearing values', () => {
    const { keyboard, state, commands } = setup()
    state.selectedCols = new Set([1, 2])
    keyboard.handleBoxKeydown(keyEvent('Delete'), 0, 0)
    expect(commands.deleteSelectedColumns).toHaveBeenCalledTimes(1)
    expect(commands.clearSelectedCellValues).not.toHaveBeenCalled()

    state.selectedCols = new Set()
    state.selectedRows = new Set([1, 2])
    keyboard.handleBoxKeydown(keyEvent('Backspace'), 0, 0)
    expect(commands.deleteSelectedRows).toHaveBeenCalledTimes(1)

    state.selectedRows = new Set()
    keyboard.handleBoxKeydown(keyEvent('Delete'), 0, 0)
    expect(commands.clearSelectedCellValues).toHaveBeenCalledTimes(1)
  })

  it('starts editing on a printable key only when the cell exists and not read-only', () => {
    const { keyboard, focus } = setup()
    keyboard.handleBoxKeydown(keyEvent('a'), 1, 1)
    expect(focus.startEdit).toHaveBeenCalledWith(1, 1, 'a')

    focus.startEdit.mockClear()
    keyboard.handleBoxKeydown(keyEvent('a', { ctrlKey: true }), 1, 1)
    expect(focus.startEdit).not.toHaveBeenCalled()

    const readOnly = setup({ readOnly: true })
    readOnly.keyboard.handleBoxKeydown(keyEvent('a'), 1, 1)
    expect(readOnly.focus.startEdit).not.toHaveBeenCalled()
  })
})
