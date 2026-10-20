import { tick } from 'svelte'
import type { createGridModel } from './use-grid-model.svelte'
import type { SelectionFocusHooks, SelectionState } from './grid-selection-state'

type Model = ReturnType<typeof createGridModel>

// Row- and column-selector interaction: the pointer drags and keyboard range
// steps for the number/letter selector cells that flank the grid. The shared
// selection state is mutated in place; the mutation commands (delete, and the
// navigation-driven row/column append) are injected so this composable owns only
// the selector surfaces.
export interface GridSelectorsOptions {
  model: Model
  focus: SelectionFocusHooks
  state: SelectionState
  readOnly: () => boolean
  deleteSelectedRows: () => void
  deleteSelectedColumns: () => void
  appendPendingRowAndSelect: () => void
  addPendingColumnAndSelect: () => void
}

export function createGridSelectors(opts: GridSelectorsOptions) {
  const { model, focus, state: s, readOnly } = opts

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
      if (dir === 1 && !readOnly()) appendFn()
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
      if (readOnly()) return
      if (s.selectedRows.size === 0) return
      const target = Math.min(...s.selectedRows)
      opts.deleteSelectedRows()
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
      v => {
        s.selectedRows = v
      },
      s.rowAnchor,
      v => {
        s.rowAnchor = v
      },
      model.headers ? 1 : 0,
      model.rowCount,
      focus.rowSelector,
      opts.appendPendingRowAndSelect,
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
      if (readOnly()) return
      if (s.selectedCols.size === 0) return
      const target = Math.min(...s.selectedCols)
      opts.deleteSelectedColumns()
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
      v => {
        s.selectedCols = v
      },
      s.colAnchor,
      v => {
        s.colAnchor = v
      },
      0,
      model.columnCount,
      focus.columnSelector,
      opts.addPendingColumnAndSelect,
      model.pruneTrailingPendingColumns,
    )
  }

  return {
    handleRowSelectorMousedown,
    handleRowSelectorMouseOver,
    handleRowSelectorKeydown,
    handleColumnSelectorMousedown,
    handleColumnSelectorMouseOver,
    handleColumnSelectorKeydown,
  }
}
