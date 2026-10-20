import { tick } from 'svelte'
import { keyOf, keysInRect } from './grid-utils'
import type { createGridModel } from './use-grid-model.svelte'
import type { createGridClipboard } from './use-grid-clipboard'
import { createGridClipboardActions } from './use-grid-clipboard'
import { createGridKeyboard } from './use-grid-keyboard.svelte'
import { createGridSelectors } from './use-grid-selectors.svelte'
import type { SelectionFocusHooks, SelectionState } from './grid-selection-state'

type Model = ReturnType<typeof createGridModel>
type Clipboard = ReturnType<typeof createGridClipboard>

export { createInitialSelectionState } from './grid-selection-state'
export type { SelectionFocusHooks, SelectionState } from './grid-selection-state'

// The grid's selection core: highlight derivation, cell drag selection, the
// mutation commands (delete/clear/trim/insert/append), and the select-all
// surface. Pointer/keyboard interaction for the row/column selectors and the
// cell box, plus the clipboard bridge, live in the `use-grid-*` composables this
// orchestrates; the returned object stays the one selection surface consumers
// (the grid and its toolbar) use.
export function createGridSelection(opts: {
  model: Model
  focus: SelectionFocusHooks
  clipboard: Clipboard
  state: SelectionState
  // Reflects the owning grid's `editable` prop at event time. A read-only grid
  // still navigates, selects, and copies, but every mutation (typing, delete,
  // navigation-driven append, paste) is refused.
  isEditable?: () => boolean
}) {
  const { model, focus, clipboard, state: s } = opts
  const readOnly = () => opts.isEditable != null && !opts.isEditable()

  const noSelection = $derived(
    s.selectedRows.size === 0 && s.selectedCols.size === 0 && s.selectedSet.size === 0 && s.selectedCell === null,
  )

  const actionRow = $derived(
    s.selectedRows.size
      ? Math.min(...s.selectedRows)
      : (s.selectedCell?.ri ?? (noSelection ? Math.max(0, model.rowCount - 1) : 0)),
  )
  const actionCol = $derived(
    s.selectedCols.size
      ? Math.min(...s.selectedCols)
      : (s.selectedCell?.ci ?? (noSelection ? Math.max(0, model.columnCount - 1) : 0)),
  )

  const rowInsertDisabled = $derived(
    s.selectedRows.size === 0 && (s.selectedCell === null || (model.headers && s.selectedCell.ri === 0)),
  )

  const colInsertDisabled = $derived(s.selectedCols.size === 0 && s.selectedCell === null)

  const highlightKeys = $derived.by(() => {
    const keys = new Set(s.selectedSet)
    if (s.selectedCell) keys.add(keyOf(s.selectedCell.ri, s.selectedCell.ci))
    for (const ri of s.selectedRows) {
      for (let c = 0; c < model.columnCount; c++) keys.add(keyOf(ri, c))
    }
    for (const ci of s.selectedCols) {
      for (let r = 0; r < model.rowCount; r++) keys.add(keyOf(r, ci))
    }
    return keys
  })

  function isCellSelected(ri: number, ci: number): boolean {
    return highlightKeys.has(keyOf(ri, ci))
  }

  function applyRange(a: { ri: number; ci: number }, b: { ri: number; ci: number }) {
    s.selectedSet = keysInRect(Math.min(a.ri, b.ri), Math.min(a.ci, b.ci), Math.max(a.ri, b.ri), Math.max(a.ci, b.ci))
  }

  function handleCellMousedown(event: MouseEvent, ri: number, ci: number) {
    s.selectedRows = new Set()
    s.selectedCols = new Set()
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const key = keyOf(ri, ci)
      const next = new Set(s.selectedSet)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      s.selectedSet = next
      s.ctrlDrag = { base: new Set(s.selectedSet) }
      s.selectedCell = { ri, ci }
      s.dragStart = { ri, ci }
      tick().then(() => focus.cellBox(ri, ci))
      return
    }
    s.ctrlDrag = null
    if (event.shiftKey) {
      event.preventDefault()
      const anchor = s.selectionAnchor ?? { ri, ci }
      s.selectedCell = { ri, ci }
      applyRange(anchor, { ri, ci })
      s.dragStart = null
      model.pruneTrailingPendingRows(ri)
      model.pruneTrailingPendingColumns(ci)
      tick().then(() => focus.cellBox(ri, ci))
      return
    }
    const same = s.selectedCell?.ri === ri && s.selectedCell?.ci === ci
    if (same) {
      if (focus.isCellInputFocused(ri, ci)) {
        // Already editing: let the input behave like a normal text field so a
        // click places the caret / drag selects text inside the cell.
        return
      }
      // A single click never enters edit mode; it keeps the box selection and
      // enables drag-to-extend from the active cell. Editing starts on
      // double-click via handleCellDoubleClick.
      event.preventDefault()
      s.dragStart = { ri, ci }
      return
    }
    event.preventDefault()
    s.selectedSet = new Set()
    s.selectionAnchor = { ri, ci }
    s.selectedCell = { ri, ci }
    s.dragStart = { ri, ci }
    model.pruneTrailingPendingRows(ri)
    model.pruneTrailingPendingColumns(ci)
    tick().then(() => focus.cellBox(ri, ci))
  }

  // Double-click enters edit mode like a spreadsheet: the first double-click
  // places the cursor after the last character; a double-click while already
  // editing selects the entire cell text.
  function handleCellDoubleClick(event: MouseEvent, ri: number, ci: number) {
    event.preventDefault()
    s.selectedSet = new Set()
    s.selectedRows = new Set()
    s.selectedCols = new Set()
    s.selectionAnchor = { ri, ci }
    s.selectedCell = { ri, ci }
    if (focus.isCellInputFocused(ri, ci)) {
      focus.cellInputSelectAll(ri, ci)
    } else {
      focus.cellInputAtEnd(ri, ci)
    }
  }

  function handleCellMouseOver(ri: number, ci: number) {
    if (!s.dragStart) return
    const r1 = Math.min(s.dragStart.ri, ri)
    const r2 = Math.max(s.dragStart.ri, ri)
    const c1 = Math.min(s.dragStart.ci, ci)
    const c2 = Math.max(s.dragStart.ci, ci)
    if (s.ctrlDrag) {
      const keys = new Set(s.ctrlDrag.base)
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) keys.add(keyOf(r, c))
      }
      s.selectedSet = keys
      s.selectedCell = { ri, ci }
      return
    }
    s.selectedSet = keysInRect(r1, c1, r2, c2)
    s.selectedCell = { ri, ci }
  }

  function endDrag() {
    s.dragStart = null
    s.ctrlDrag = null
    s.rowDragStart = null
    s.ctrlRowDrag = null
    s.colDragStart = null
    s.ctrlColDrag = null
  }

  const isDragging = () => s.dragStart !== null || s.rowDragStart !== null || s.colDragStart !== null

  function handleSelectAllMousedown(event: MouseEvent) {
    event.preventDefault()
    selectAllCells()
  }

  function handleSelectAllKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      selectAllCells()
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (!readOnly()) clearSelectedCellValues()
    } else if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      selectAllCells()
    }
  }

  function selectAllCells() {
    if (model.rowCount === 0 || model.columnCount === 0) return
    s.selectedSet = keysInRect(0, 0, model.rowCount - 1, model.columnCount - 1)
    s.selectedCell = null
    s.selectedRows = new Set()
    s.selectedCols = new Set()
  }

  function deleteSelectedRows() {
    if (s.selectedRows.size === 0) return
    if (!model.deleteRows(s.selectedRows)) return
    s.selectedCell = null
    s.selectedSet = new Set()
    s.selectedRows = new Set()
  }

  function deleteSelectedColumns() {
    if (s.selectedCols.size === 0) return
    model.deleteColumns(s.selectedCols)
    s.selectedCell = null
    s.selectedSet = new Set()
    s.selectedCols = new Set()
  }

  function clearSelectedCellValues() {
    const cellsToClear = new Set<string>()
    for (const ri of s.selectedRows) {
      for (let c = 0; c < model.columnCount; c++) cellsToClear.add(keyOf(ri, c))
    }
    for (const ci of s.selectedCols) {
      for (let r = 0; r < model.rowCount; r++) cellsToClear.add(keyOf(r, ci))
    }
    for (const key of s.selectedSet) cellsToClear.add(key)
    if (s.selectedCell) cellsToClear.add(keyOf(s.selectedCell.ri, s.selectedCell.ci))
    model.clearValues(cellsToClear)
  }

  function appendPendingRowAndSelect() {
    const newRi = model.appendPendingRow()
    s.selectedSet = new Set()
    s.selectedCell = null
    s.selectedCols = new Set()
    s.selectedRows = new Set([newRi])
    s.rowAnchor = newRi
    tick().then(() => focus.rowSelector(newRi))
  }

  function addPendingColumnAndSelect() {
    const newCi = model.appendPendingColumn()
    s.selectedSet = new Set()
    s.selectedCell = null
    s.selectedRows = new Set()
    s.selectedCols = new Set([newCi])
    s.colAnchor = newCi
    tick().then(() => focus.columnSelector(newCi))
  }

  function insertRowAt(index: number, after: boolean) {
    model.insertRowAt(index, after)
  }

  function insertColumnAt(col: number, focusNew: boolean) {
    model.insertColumnAt(col)
    if (focusNew) tick().then(() => focus.cellInput(0, col))
  }

  function addRow() {
    const ri = model.appendRow()
    tick().then(() => focus.cellInputAtEnd(ri, 0))
  }

  function addColumn(focusNew = true) {
    const newCi = model.appendColumn()
    if (focusNew) tick().then(() => focus.cellInputAtEnd(0, newCi))
  }

  function setActiveCell(ri: number, ci: number) {
    s.selectedCell = { ri, ci }
  }

  function trimSelected() {
    model.trimTrailingEmptyRows()
    model.trimTrailingEmptyColumns()
    s.selectedCell = null
    s.selectedSet = new Set()
    s.selectedRows = new Set()
    s.selectedCols = new Set()
  }

  const clipboardActions = createGridClipboardActions({
    clipboard,
    model,
    getHighlightKeys: () => highlightKeys,
    getSelectedCell: () => s.selectedCell,
    focusCellBox: (ri, ci) => focus.cellBox(ri, ci),
    clearSelectedCellValues,
  })

  const keyboard = createGridKeyboard({
    model,
    focus,
    state: s,
    readOnly,
    applyRange,
    selectAllCells,
    clearSelectedCellValues,
    deleteSelectedRows,
    deleteSelectedColumns,
    copySelection: clipboardActions.copySelection,
    cutSelection: clipboardActions.cutSelection,
    pasteSelection: clipboardActions.pasteSelection,
    setActiveCell,
  })

  const selectors = createGridSelectors({
    model,
    focus,
    state: s,
    readOnly,
    deleteSelectedRows,
    deleteSelectedColumns,
    appendPendingRowAndSelect,
    addPendingColumnAndSelect,
  })

  return {
    get selectedCell() {
      return s.selectedCell
    },
    get selectedSet() {
      return s.selectedSet
    },
    get selectedRows() {
      return s.selectedRows
    },
    get selectedCols() {
      return s.selectedCols
    },
    get noSelection() {
      return noSelection
    },
    get actionRow() {
      return actionRow
    },
    get actionCol() {
      return actionCol
    },
    get rowInsertDisabled() {
      return rowInsertDisabled
    },
    get colInsertDisabled() {
      return colInsertDisabled
    },
    get highlightKeys() {
      return highlightKeys
    },
    get isDragging() {
      return isDragging
    },
    isCellSelected,
    isRowSelected: (ri: number) => s.selectedRows.has(ri),
    isColumnSelected: (ci: number) => s.selectedCols.has(ci),
    handleCellMousedown,
    handleCellDoubleClick,
    handleCellMouseOver,
    ...selectors,
    handleSelectAllMousedown,
    handleSelectAllKeydown,
    ...keyboard,
    selectAllCells,
    endDrag,
    setActiveCell,
    insertRowAt,
    insertColumnAt,
    addRow,
    addColumn,
    deleteSelectedRows,
    deleteSelectedColumns,
    clearSelectedCellValues,
    trimSelected,
  }
}
