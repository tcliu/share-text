// The grid's selection state shape and its initial value. Kept apart from the
// selection composable so the row/column selector and keyboard composables can
// depend on the shared state type without importing (and cycling through) the
// selection orchestrator.

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
