import { tick } from 'svelte'
import type { SelectionFocusHooks } from './grid-selection-state'
import type { createGridModel, HistoryState } from './use-grid-model.svelte'
import type { createGridSelection } from './use-grid-selection.svelte'

type Model = ReturnType<typeof createGridModel>
type Selection = ReturnType<typeof createGridSelection>

// The grid's undo/redo controls: the reactive history state the toolbar reads,
// the Ctrl+Z/Y shortcut, and focus restoration after a history change. The
// stacks themselves live in the model.
export interface GridUndoRedoOptions {
  model: Model
  focus: SelectionFocusHooks
  sel: Selection
  isEditable: () => boolean
}

export function createGridUndoRedo(opts: GridUndoRedoOptions) {
  const { model, focus, sel } = opts

  let historyState = $state<HistoryState>({ canUndo: false, canRedo: false })
  $effect(() => {
    return model.onHistory(state => {
      historyState = state
    })
  })

  function restoreFocusAfterHistoryChange() {
    const cell = sel.selectedCell
    tick().then(() => {
      // Undo/redo can shrink the matrix below the selected cell (e.g. undoing a
      // paste into a navigation-appended row removes that row). Clamp to a cell
      // that still exists so focus stays inside the grid instead of falling to
      // <body>, where the history and navigation shortcuts no longer fire.
      if (!cell || model.rowCount === 0 || model.columnCount === 0) return
      const ri = Math.min(cell.ri, model.rowCount - 1)
      const ci = Math.min(cell.ci, model.columnCount - 1)
      if (!model.rows[ri]?.cells[ci]) return
      if (ri !== cell.ri || ci !== cell.ci) sel.setActiveCell(ri, ci)
      focus.cellBox(ri, ci)
    })
  }

  function handleHistoryKeydown(event: KeyboardEvent) {
    if (!opts.isEditable()) return
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) model.redo()
      else model.undo()
      restoreFocusAfterHistoryChange()
    } else if (key === 'y') {
      event.preventDefault()
      model.redo()
      restoreFocusAfterHistoryChange()
    }
  }

  function undo() {
    model.undo()
    restoreFocusAfterHistoryChange()
  }

  function redo() {
    model.redo()
    restoreFocusAfterHistoryChange()
  }

  return {
    get historyState() {
      return historyState
    },
    handleHistoryKeydown,
    undo,
    redo,
  }
}
