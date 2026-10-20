import { tick } from 'svelte'
import type { SelectionFocusHooks } from './grid-selection-state'
import type { createGridModel } from './use-grid-model.svelte'
import type { createGridSelection } from './use-grid-selection.svelte'

type Model = ReturnType<typeof createGridModel>
type Selection = ReturnType<typeof createGridSelection>

// The grid's in-cell editing controller: which cell's editor is focused, the
// pre-edit snapshot used to revert on Escape, and the input key/paste/blur
// handlers. The overlay sizing lives in the component's markup.
export interface GridEditorOptions {
  model: Model
  focus: SelectionFocusHooks
  sel: Selection
  isEditable: () => boolean
}

export function createGridEditor(opts: GridEditorOptions) {
  const { model, focus, sel } = opts

  let editSnapshot: { ri: number; ci: number; value: string; committed: boolean } = {
    ri: -1,
    ci: -1,
    value: '',
    committed: true,
  }

  let editingCell = $state<{ ri: number; ci: number } | null>(null)

  function isCellEditing(ri: number, ci: number): boolean {
    return editingCell?.ri === ri && editingCell?.ci === ci
  }

  function handleInputFocus(ri: number, ci: number) {
    const cell = model.rows[ri]?.cells[ci]
    editSnapshot = { ri, ci, value: cell?.value ?? '', committed: cell?.committed ?? true }
    sel.setActiveCell(ri, ci)
    editingCell = { ri, ci }
  }

  function handleInputKeydown(event: KeyboardEvent, ri: number, ci: number) {
    if (event.key === 'Tab') {
      let next: { ri: number; ci: number } | null = null
      if (event.shiftKey) {
        if (ci > 0) {
          next = { ri, ci: ci - 1 }
        } else if (ri > 0) {
          next = { ri: ri - 1, ci: model.columnCount - 1 }
        }
      } else if (ci < model.columnCount - 1) {
        next = { ri, ci: ci + 1 }
      } else if (ri < model.rowCount - 1) {
        next = { ri: ri + 1, ci: 0 }
      }
      // No in-grid target at the boundary: leave the key alone so Tab carries
      // focus out of the grid in natural document order instead of trapping it
      // on the edge cell.
      if (next === null) return
      event.preventDefault()
      focus.cellInput(next.ri, next.ci)
      return
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Insert a newline (default textarea behavior); the oninput handler
      // persists it and the cell grows to double height.
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const nextRi = Math.min(model.rowCount - 1, ri + 1)
      sel.setActiveCell(nextRi, ci)
      ;(event.target as HTMLTextAreaElement).blur()
      tick().then(() => focus.cellBox(nextRi, ci))
    } else if (event.key === 'Escape') {
      event.preventDefault()
      const cell = model.rows[ri]?.cells[ci]
      if (cell && editSnapshot.ri === ri && editSnapshot.ci === ci) {
        cell.value = editSnapshot.value
        cell.committed = editSnapshot.committed
      }
      ;(event.target as HTMLTextAreaElement).blur()
      model.pruneTrailingPendingRows(ri - 1)
      model.pruneTrailingPendingColumns(ci - 1)
      const target = model.rows[ri] ? ri : ri - 1
      if (model.rows[target]) {
        tick().then(() => focus.cellBox(target, ci))
      }
    }
  }

  function handleBoxPaste(event: ClipboardEvent, ri: number, ci: number) {
    if (!opts.isEditable()) return
    if (event.target !== event.currentTarget) return
    const text = event.clipboardData?.getData('text') ?? ''
    if (!text) return
    event.preventDefault()
    model.applyPastedText(ri, ci, text)
    sel.setActiveCell(ri, ci)
    focus.cellInput(ri, ci)
  }

  function handleBodyBlur() {
    editingCell = null
    model.flushCommit()
  }

  return {
    get editingCell() {
      return editingCell
    },
    isCellEditing,
    handleInputFocus,
    handleInputKeydown,
    handleBoxPaste,
    handleBodyBlur,
  }
}
