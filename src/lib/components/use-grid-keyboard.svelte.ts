import { tick } from 'svelte'
import { moveSelection } from './grid-utils'
import type { createGridModel } from './use-grid-model.svelte'
import type { SelectionFocusHooks, SelectionState } from './grid-selection-state'

type Model = ReturnType<typeof createGridModel>

// Cell-box keyboard navigation: the arrow/Enter/Escape/delete/clipboard bindings
// on the focusable grid cell boxes, plus the helpers that hand focus to a row or
// column selector at the grid's edge. Selection state, mutation commands, and
// focus hooks are injected, so this composable owns only the key mapping and the
// focus movement it drives.
export interface GridKeyboardOptions {
  model: Model
  focus: SelectionFocusHooks
  state: SelectionState
  readOnly: () => boolean
  applyRange: (a: { ri: number; ci: number }, b: { ri: number; ci: number }) => void
  selectAllCells: () => void
  clearSelectedCellValues: () => void
  deleteSelectedRows: () => void
  deleteSelectedColumns: () => void
  copySelection: () => void
  cutSelection: () => void
  pasteSelection: () => void
  setActiveCell: (ri: number, ci: number) => void
}

export function createGridKeyboard(opts: GridKeyboardOptions) {
  const { model, focus, state: s, readOnly } = opts

  function selectRowViaSelector(ri: number) {
    s.selectedSet = new Set()
    s.selectedCell = null
    s.selectedCols = new Set()
    s.selectedRows = new Set([ri])
    s.rowAnchor = ri
    focus.rowSelector(ri)
  }

  function selectColumnViaHeader(ci: number) {
    s.selectedSet = new Set()
    s.selectedCell = null
    s.selectedRows = new Set()
    s.selectedCols = new Set([ci])
    s.colAnchor = ci
    focus.columnSelector(ci)
  }

  function appendArrowRow(ci: number) {
    const ri = model.appendPendingRow()
    s.selectedSet = new Set()
    s.selectionAnchor = { ri, ci }
    s.selectedCell = { ri, ci }
    tick().then(() => focus.cellBox(ri, ci))
  }

  function handleBoxKeydown(event: KeyboardEvent, ri: number, ci: number) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter') {
      event.preventDefault()
      opts.setActiveCell(ri, ci)
      focus.cellInput(ri, ci)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      focus.cellBox(ri, ci)
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      if (!readOnly() && event.key === 'ArrowDown' && ri === model.rowCount - 1 && !event.shiftKey) {
        appendArrowRow(ci)
        return
      }
      if (!readOnly() && event.key === 'ArrowRight' && ci === model.columnCount - 1 && !event.shiftKey) {
        const newCi = model.appendPendingColumn()
        s.selectedSet = new Set()
        s.selectionAnchor = { ri, ci: newCi }
        s.selectedCell = { ri, ci: newCi }
        tick().then(() => focus.cellBox(ri, newCi))
        return
      }
      if (event.key === 'ArrowLeft' && ci === 0 && !event.shiftKey) {
        const hasRowSelector = model.headers ? ri >= 1 : ri >= 0
        if (hasRowSelector) {
          selectRowViaSelector(ri)
          return
        }
      }
      if (event.key === 'ArrowUp' && !event.shiftKey && ri === 0) {
        selectColumnViaHeader(ci)
        return
      }
      const next = moveSelection(ri, ci, event.key, model.rowCount, model.columnCount)
      if (next) {
        s.selectedRows = new Set()
        s.selectedCols = new Set()
        if (event.shiftKey) {
          const anchor = s.selectionAnchor ?? { ri, ci }
          s.selectedCell = next
          opts.applyRange(anchor, next)
        } else {
          s.selectedSet = new Set()
          s.selectionAnchor = next
          s.selectedCell = next
        }
        model.pruneTrailingPendingRows(next.ri)
        model.pruneTrailingPendingColumns(next.ci)
        focus.cellBox(next.ri, next.ci)
      }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (readOnly()) return
      if (s.selectedCols.size > 0) {
        const target = Math.min(...s.selectedCols)
        opts.deleteSelectedColumns()
        const after = Math.min(target, model.columnCount - 1)
        if (after >= 0) tick().then(() => focus.columnSelector(after))
      } else if (s.selectedRows.size > 0) {
        const target = Math.min(...s.selectedRows)
        opts.deleteSelectedRows()
        const after = Math.min(target, model.rowCount - 1)
        if (after >= 0) tick().then(() => focus.rowSelector(after))
      } else {
        opts.clearSelectedCellValues()
      }
    } else if ((event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      opts.copySelection()
    } else if ((event.key === 'x' || event.key === 'X') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (readOnly()) return
      opts.cutSelection()
    } else if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      opts.selectAllCells()
    } else if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (readOnly()) return
      opts.pasteSelection()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (readOnly()) return
      if (!model.rows[ri]?.cells[ci]) return
      focus.startEdit(ri, ci, event.key)
    }
  }

  return { handleBoxKeydown }
}
