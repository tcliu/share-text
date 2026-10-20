import { matrixEqual } from './grid-utils'

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export type HistoryListener = (state: HistoryState) => void

const MAX_HISTORY = 100

// Undo/redo history for the grid model: the two snapshot stacks, the change
// listeners, and the snapshot cap. The model owns the row matrix; this
// composable owns only the snapshots and hands one back for the model to apply.
export function createGridHistory() {
  let undoStack = $state<string[][][]>([])
  let redoStack = $state<string[][][]>([])
  const listeners = new Set<HistoryListener>()

  const canUndo = $derived(undoStack.length > 0)
  const canRedo = $derived(redoStack.length > 0)

  function currentState(): HistoryState {
    return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }
  }

  function emit() {
    const state = currentState()
    for (const listener of [...listeners]) listener(state)
  }

  function onChange(listener: HistoryListener): () => void {
    listeners.add(listener)
    listener(currentState())
    return () => listeners.delete(listener)
  }

  function reset() {
    undoStack = []
    redoStack = []
    emit()
  }

  function push(snapshot: string[][]) {
    const copy = snapshot.map(r => r.slice())
    const top = undoStack[undoStack.length - 1]
    if (top && matrixEqual(top, copy)) return
    undoStack.push(copy)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
    emit()
  }

  function undo(current: string[][]): string[][] | null {
    const snapshot = undoStack.pop()
    if (!snapshot) return null
    redoStack.push(current)
    return snapshot
  }

  function redo(current: string[][]): string[][] | null {
    const snapshot = redoStack.pop()
    if (!snapshot) return null
    undoStack.push(current)
    return snapshot
  }

  return {
    get canUndo() {
      return canUndo
    },
    get canRedo() {
      return canRedo
    },
    onChange,
    reset,
    push,
    undo,
    redo,
    emit,
  }
}
