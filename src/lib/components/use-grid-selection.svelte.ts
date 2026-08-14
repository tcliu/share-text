import { tick } from 'svelte'
import { keyOf, keysInRect, rectOfKeys, columnLetter } from './grid-utils'
import type { createGridModel } from './use-grid-model.svelte'
import type { createGridClipboard } from './use-grid-clipboard'

// The cyan color used for the selection outline, applied by recoloring the
// cell borders that form the grid lines. Exported so the multiline editor
// overlay can keep its expanded border in the same color while a cell is being
// edited (the editing cell is always selected).
export const RANGE_COLOR = 'rgba(34, 211, 238, 0.6)'

type Model = ReturnType<typeof createGridModel>
type Clipboard = ReturnType<typeof createGridClipboard>

export interface SelectionFocusHooks {
  cellBox: (ri: number, ci: number) => void
  cellInput: (ri: number, ci: number) => void
  cellInputAtEnd: (ri: number, ci: number) => void
  cellInputSelectAll: (ri: number, ci: number) => void
  startEdit: (ri: number, ci: number, value: string) => void
  rowSelector: (ri: number) => void
  columnSelector: (ci: number) => void
  isCellInputFocused: (ri: number, ci: number) => boolean
}

export interface SelectionState {
  selectedCell: { ri: number; ci: number } | null
  selectedSet: Set<string>
  selectedRows: Set<number>
  selectedCols: Set<number>
  selectionAnchor: { ri: number; ci: number } | null
  rowAnchor: number | null
  colAnchor: number | null
  dragStart: { ri: number; ci: number } | null
  ctrlDrag: { base: Set<string> } | null
  rowDragStart: number | null
  ctrlRowDrag: { base: Set<number> } | null
  colDragStart: number | null
  ctrlColDrag: { base: Set<number> } | null
}

export function createInitialSelectionState(): SelectionState {
  return {
    selectedCell: null,
    selectedSet: new Set(),
    selectedRows: new Set(),
    selectedCols: new Set(),
    selectionAnchor: null,
    rowAnchor: null,
    colAnchor: null,
    dragStart: null,
    ctrlDrag: null,
    rowDragStart: null,
    ctrlRowDrag: null,
    colDragStart: null,
    ctrlColDrag: null,
  }
}

export function createGridSelection(opts: {
  model: Model
  focus: SelectionFocusHooks
  clipboard: Clipboard
  state: SelectionState
}) {
  const { model, focus, clipboard, state: s } = opts

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

  const colInsertDisabled = $derived(
    s.selectedCols.size === 0 && s.selectedCell === null,
  )

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

  function cellClass(base: string, ri: number, ci: number): string {
    if (!isCellSelected(ri, ci)) return base
    return `${base} bg-slate-800 outline-none`
  }

  // The selection outline is drawn by recoloring the actual cell borders that
  // form the grid lines, so the cyan line sits exactly on top of the border it
  // separates (a highlighted cell and a non-highlighted cell). The grid line
  // between two cells is the right/bottom border of the cell that owns it, so
  // every data cell colors border-right/border-bottom cyan when its selection
  // state differs from the adjacent cell's — the outline is the set of grid
  // lines between the highlighted region and the rest of the grid.
  function rangeHighlightStyle(ri: number, ci: number): string {
    const parts: string[] = []
    if (isCellSelected(ri, ci) !== isCellSelected(ri + 1, ci)) parts.push(`border-bottom-color:${RANGE_COLOR}`)
    if (isCellSelected(ri, ci) !== isCellSelected(ri, ci + 1)) parts.push(`border-right-color:${RANGE_COLOR}`)
    return parts.join(';')
  }

  // The column-label row's bottom borders are the grid lines above the
  // header-data row (or the first data row when headers are off), so they carry
  // the outline's top edge for a region touching the top of the grid.
  function labelRowBorderStyle(ci: number): string {
    return isCellSelected(0, ci) ? `border-bottom-color:${RANGE_COLOR}` : ''
  }

  // The select-all cell sits above the header-data row's first cell; its bottom
  // border is the top edge of a region that includes cell (0, 0).
  function selectAllBorderStyle(): string {
    return isCellSelected(0, 0) ? `border-bottom-color:${RANGE_COLOR}` : ''
  }

  // The row-number cells' right borders are the grid lines left of column 0, so
  // they carry the outline's left edge for a region touching column 0.
  function rowNumberBorderStyle(ri: number): string {
    return isCellSelected(ri, 0) ? `border-right-color:${RANGE_COLOR}` : ''
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

  function handleRowSelectorMousedown(event: MouseEvent, ri: number) {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement)?.focus()
    s.selectedSet = new Set()
    s.selectedCell = null
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(s.selectedRows)
      if (next.has(ri)) next.delete(ri)
      else next.add(ri)
      s.selectedRows = next
      s.rowDragStart = ri
      s.ctrlRowDrag = { base: new Set(s.selectedRows) }
      return
    }
    s.selectedCols = new Set()
    if (event.shiftKey && s.rowAnchor !== null) {
      const min = Math.min(s.rowAnchor, ri)
      const max = Math.max(s.rowAnchor, ri)
      const next = new Set<number>()
      for (let r = min; r <= max; r++) next.add(r)
      s.selectedRows = next
      s.rowDragStart = null
      s.ctrlRowDrag = null
      return
    }
    s.selectedRows = new Set([ri])
    model.pruneTrailingPendingRows(ri)
    s.rowAnchor = ri
    s.rowDragStart = ri
    s.ctrlRowDrag = null
  }

  function handleRowSelectorMouseOver(ri: number) {
    if (s.rowDragStart === null) return
    const r1 = Math.min(s.rowDragStart, ri)
    const r2 = Math.max(s.rowDragStart, ri)
    if (s.ctrlRowDrag) {
      const next = new Set(s.ctrlRowDrag.base)
      for (let r = r1; r <= r2; r++) next.add(r)
      s.selectedRows = next
      return
    }
    const next = new Set<number>()
    for (let r = r1; r <= r2; r++) next.add(r)
    s.selectedRows = next
  }

  function handleSelectorDirectionNav(
    event: KeyboardEvent,
    currentIndex: number,
    dir: number,
    isRow: boolean,
    selectedSet: Set<number>,
    setSelected: (s: Set<number>) => void,
    anchor: number | null,
    setAnchor: (a: number) => void,
    minIndex: number,
    count: number,
    focusFn: (i: number) => void,
    appendFn: () => void,
    pruneFn: (i: number) => void,
  ) {
    event.preventDefault()
    if (selectedSet.size === 0) return
    s.selectedSet = new Set()
    s.selectedCell = null
    if (isRow) {
      s.selectedCols = new Set()
    } else {
      s.selectedRows = new Set()
    }
    if (event.shiftKey) {
      const a = anchor ?? Math.min(...selectedSet)
      const currentMin = Math.min(...selectedSet)
      const currentMax = Math.max(...selectedSet)
      const edge = dir === 1 ? currentMax + 1 : currentMax > a ? currentMax - 1 : currentMin - 1
      if (edge < minIndex || edge >= count) return
      const min = Math.min(a, edge)
      const max = Math.max(a, edge)
      const next = new Set<number>()
      for (let i = min; i <= max; i++) next.add(i)
      setSelected(next)
      focusFn(dir === 1 ? max : min)
      return
    }
    const next = currentIndex + dir
    if (next < minIndex) return
    if (next >= count) {
      if (dir === 1) appendFn()
      return
    }
    setSelected(new Set([next]))
    setAnchor(next)
    pruneFn(next)
    focusFn(next)
  }

  function handleRowSelectorKeydown(event: KeyboardEvent, ri: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (ri < 0 || ri >= model.rowCount) return
      s.selectedSet = new Set()
      s.selectedRows = new Set()
      s.selectedCols = new Set()
      s.selectionAnchor = { ri, ci: 0 }
      s.selectedCell = { ri, ci: 0 }
      focus.cellBox(ri, 0)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (s.selectedRows.size === 0) return
      const target = Math.min(...s.selectedRows)
      deleteSelectedRows()
      const after = Math.min(target, model.rowCount - 1)
      if (after >= 0) tick().then(() => focus.rowSelector(after))
      return
    }
    const dir = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (dir === 0) return
    handleSelectorDirectionNav(
      event,
      ri,
      dir,
      true,
      s.selectedRows,
      v => { s.selectedRows = v },
      s.rowAnchor,
      v => { s.rowAnchor = v },
      model.headers ? 1 : 0,
      model.rowCount,
      focus.rowSelector,
      appendPendingRowAndSelect,
      model.pruneTrailingPendingRows,
    )
  }

  function handleColumnSelectorMousedown(event: MouseEvent, ci: number) {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement)?.focus()
    s.selectedSet = new Set()
    s.selectedCell = null
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(s.selectedCols)
      if (next.has(ci)) next.delete(ci)
      else next.add(ci)
      s.selectedCols = next
      s.colDragStart = ci
      s.ctrlColDrag = { base: new Set(s.selectedCols) }
      return
    }
    s.selectedRows = new Set()
    if (event.shiftKey && s.colAnchor !== null) {
      const min = Math.min(s.colAnchor, ci)
      const max = Math.max(s.colAnchor, ci)
      const next = new Set<number>()
      for (let c = min; c <= max; c++) next.add(c)
      s.selectedCols = next
      s.colDragStart = null
      s.ctrlColDrag = null
      return
    }
    s.selectedCols = new Set([ci])
    model.pruneTrailingPendingColumns(ci)
    s.colAnchor = ci
    s.colDragStart = ci
    s.ctrlColDrag = null
  }

  function handleColumnSelectorMouseOver(ci: number) {
    if (s.colDragStart === null) return
    const c1 = Math.min(s.colDragStart, ci)
    const c2 = Math.max(s.colDragStart, ci)
    if (s.ctrlColDrag) {
      const next = new Set(s.ctrlColDrag.base)
      for (let c = c1; c <= c2; c++) next.add(c)
      s.selectedCols = next
      return
    }
    const next = new Set<number>()
    for (let c = c1; c <= c2; c++) next.add(c)
    s.selectedCols = next
  }

  function handleColumnSelectorKeydown(event: KeyboardEvent, ci: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (ci < 0 || ci >= model.columnCount) return
      s.selectedSet = new Set()
      s.selectedRows = new Set()
      s.selectedCols = new Set()
      s.selectionAnchor = { ri: 0, ci }
      s.selectedCell = { ri: 0, ci }
      focus.cellBox(0, ci)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (s.selectedCols.size === 0) return
      const target = Math.min(...s.selectedCols)
      deleteSelectedColumns()
      const after = Math.min(target, model.columnCount - 1)
      if (after >= 0) tick().then(() => focus.columnSelector(after))
      return
    }
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (dir === 0) return
    handleSelectorDirectionNav(
      event,
      ci,
      dir,
      false,
      s.selectedCols,
      v => { s.selectedCols = v },
      s.colAnchor,
      v => { s.colAnchor = v },
      0,
      model.columnCount,
      focus.columnSelector,
      addPendingColumnAndSelect,
      model.pruneTrailingPendingColumns,
    )
  }

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
      clearSelectedCellValues()
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

  function moveSelection(ri: number, ci: number, key: string): { ri: number; ci: number } | null {
    let nr = ri
    let nc = ci
    if (key === 'ArrowUp') nr = Math.max(0, ri - 1)
    else if (key === 'ArrowDown') nr = Math.min(model.rowCount - 1, ri + 1)
    else if (key === 'ArrowLeft') nc = Math.max(0, ci - 1)
    else if (key === 'ArrowRight') nc = Math.min(model.columnCount - 1, ci + 1)
    else return null
    if (nr === ri && nc === ci) return null
    return { ri: nr, ci: nc }
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
      setActiveCell(ri, ci)
      focus.cellInput(ri, ci)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      focus.cellBox(ri, ci)
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      if (event.key === 'ArrowDown' && ri === model.rowCount - 1 && !event.shiftKey) {
        appendArrowRow(ci)
        return
      }
      if (event.key === 'ArrowRight' && ci === model.columnCount - 1 && !event.shiftKey) {
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
      const next = moveSelection(ri, ci, event.key)
      if (next) {
        s.selectedRows = new Set()
        s.selectedCols = new Set()
        if (event.shiftKey) {
          const anchor = s.selectionAnchor ?? { ri, ci }
          s.selectedCell = next
          applyRange(anchor, next)
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
      if (s.selectedCols.size > 0) {
        const target = Math.min(...s.selectedCols)
        deleteSelectedColumns()
        const after = Math.min(target, model.columnCount - 1)
        if (after >= 0) tick().then(() => focus.columnSelector(after))
      } else if (s.selectedRows.size > 0) {
        const target = Math.min(...s.selectedRows)
        deleteSelectedRows()
        const after = Math.min(target, model.rowCount - 1)
        if (after >= 0) tick().then(() => focus.rowSelector(after))
      } else {
        clearSelectedCellValues()
      }
    } else if ((event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      copySelection()
    } else if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      selectAllCells()
    } else if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      pasteSelection()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (!model.rows[ri]?.cells[ci]) return
      focus.startEdit(ri, ci, event.key)
    }
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

  function copySelection() {
    if (highlightKeys.size === 0) return
    const b = rectOfKeys(highlightKeys)
    if (!b) return
    const lines: string[] = []
    for (let r = b.r1; r <= b.r2; r++) {
      const parts: string[] = []
      for (let c = b.c1; c <= b.c2; c++) {
        parts.push(model.rows[r]?.cells[c]?.value ?? '')
      }
      lines.push(parts.join('\t'))
    }
    const text = lines.join('\n')
    if (text) clipboard.copy(text)
  }

  function pasteSelection() {
    if (!s.selectedCell) return
    clipboard.paste(s.selectedCell.ri, s.selectedCell.ci, (ri, ci, text) => {
      model.applyPastedText(ri, ci, text)
    })
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

  function removeRowAt(index: number) {
    if (index < 0 || index >= model.rowCount) return
    const clickedSelected = s.selectedRows.has(index)
    if (clickedSelected) {
      deleteSelectedRows()
    } else {
      if (model.headers && index === 0) return
      model.removeRowAt(index)
      s.selectedRows = new Set()
      s.selectedSet = new Set()
      s.selectedCell = null
    }
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

  function rowSelectorClass(ri: number): string {
    const selected = s.selectedRows.has(ri)
    const bg = ri % 2 === 1 ? 'bg-[#0b1222]' : 'bg-slate-950'
    return `sticky left-0 z-10 w-9 cursor-pointer border-b border-r border-b-slate-800 border-r-slate-500 p-0 text-right outline-none ${selected ? 'bg-slate-800' : bg}`
  }

  function columnSelectorClass(ci: number, isLastColumn = false): string {
    const selected = s.selectedCols.has(ci)
    const rightBorder = isLastColumn ? 'border-r-slate-800' : 'border-r-slate-500'
    return `min-w-32 h-6 cursor-pointer border-b border-r border-b-slate-600 ${rightBorder} p-0 text-center text-xs font-normal outline-none ${selected ? 'bg-slate-800' : ''}`
  }

  function trClass(index: number): string {
    return index % 2 === 0 ? 'bg-slate-950' : 'bg-[#0b1222]'
  }

  return {
    get selectedCell() { return s.selectedCell },
    get selectedSet() { return s.selectedSet },
    get selectedRows() { return s.selectedRows },
    get selectedCols() { return s.selectedCols },
    get noSelection() { return noSelection },
    get actionRow() { return actionRow },
    get actionCol() { return actionCol },
    get rowInsertDisabled() { return rowInsertDisabled },
    get colInsertDisabled() { return colInsertDisabled },
    get highlightKeys() { return highlightKeys },
    get isDragging() { return isDragging },
    isCellSelected,
    cellClass,
    rangeHighlightStyle,
    labelRowBorderStyle,
    selectAllBorderStyle,
    rowNumberBorderStyle,
    rowSelectorClass,
    columnSelectorClass,
    trClass,
    columnLetter,
    handleCellMousedown,
    handleCellDoubleClick,
    handleCellMouseOver,
    handleRowSelectorMousedown,
    handleRowSelectorMouseOver,
    handleRowSelectorKeydown,
    handleColumnSelectorMousedown,
    handleColumnSelectorMouseOver,
    handleColumnSelectorKeydown,
    handleSelectAllMousedown,
    handleSelectAllKeydown,
    handleBoxKeydown,
    selectAllCells,
    endDrag,
    setActiveCell,
    insertRowAt,
    removeRowAt,
    insertColumnAt,
    addRow,
    addColumn,
    deleteSelectedRows,
    deleteSelectedColumns,
    clearSelectedCellValues,
    trimSelected,
  }
}
