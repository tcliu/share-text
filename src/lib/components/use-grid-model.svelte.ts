import { isEmptyValue, matrixEqual } from './grid-utils'

interface Cell {
  id: number
  value: string
  // Whether the cell has been authored (typed, pasted, or structurally created).
  // Empty rows/columns appended by pure navigation stay uncommitted so they are
  // excluded from the serialized matrix until the user actually enters a value.
  committed: boolean
}
interface Row {
  id: number
  cells: Cell[]
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export type HistoryListener = (state: HistoryState) => void

export interface GridModelOptions {
  getValue: () => string[][]
  getHeaders: () => boolean
  onChange?: (rows: string[][]) => void
  // Locks the grid to a fixed column count: column insert/delete/append/nav
  // growth and column trimming are disabled, cells keep exactly this many
  // columns, and pastes are clamped to it.
  maxColumns?: number
}

const MAX_HISTORY = 100

export function createGridModel(options: GridModelOptions) {
  let cellId = 0
  let rowId = 0
  const newCell = (value = '', committed = true): Cell => ({ id: ++cellId, value, committed })
  const newRow = (cols: number, committed = true): Row => ({
    id: ++rowId,
    cells: Array.from({ length: cols }, () => newCell('', committed)),
  })

  let rows = $state<Row[]>([])
  let lastValue: string[][] = []
  let pending = false
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  const colCap = options.maxColumns

  let undoStack = $state<string[][][]>([])
  let redoStack = $state<string[][][]>([])
  const historyListeners = new Set<HistoryListener>()

  function currentMatrix(): string[][] {
    return committedMatrix()
  }

  // The serialized matrix bounds itself to the last row/column that has any
  // authored (committed) cell, so rows/columns appended by pure navigation and
  // never typed into stay out of the document until a value is entered.
  function committedMatrix(): string[][] {
    const cols = lastCommittedCol + 1
    const rowsCount = lastCommittedRow + 1
    if (rowsCount <= 0 || cols <= 0) return []
    return rows.slice(0, rowsCount).map(r => r.cells.slice(0, cols).map(c => c.value))
  }

  function emitHistory() {
    const state: HistoryState = { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }
    for (const listener of [...historyListeners]) listener(state)
  }

  function onHistory(listener: HistoryListener): () => void {
    historyListeners.add(listener)
    listener({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 })
    return () => historyListeners.delete(listener)
  }

  function resetHistory() {
    undoStack = []
    redoStack = []
    emitHistory()
  }

  const canUndo = $derived(undoStack.length > 0)
  const canRedo = $derived(redoStack.length > 0)

  const columnCount = $derived(rows.length ? Math.max(...rows.map(r => r.cells.length)) : 0)
  const rowCount = $derived(rows.length)
  const headers = $derived(options.getHeaders())

  const lastCommittedRow = $derived.by(() => {
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      if (rows[ri].cells.some(c => c.committed)) return ri
    }
    return -1
  })

  const lastCommittedCol = $derived.by(() => {
    for (let ci = columnCount - 1; ci >= 0; ci--) {
      if (rows.some(r => r.cells[ci]?.committed)) return ci
    }
    return -1
  })

  const needsTrim = $derived.by(() => {
    if (rowCount === 0) return false
    // Uncommitted rows/columns appended by navigation are always trimmable.
    if (lastCommittedRow + 1 < rowCount) return true
    if (colCap == null && lastCommittedCol + 1 < columnCount) return true
    const isEmpty = isEmptyValue
    const lastRow = findLastRowWithData()
    if (lastRow < lastCommittedRow) return true
    if (colCap != null) return false
    let lastCol = -1
    for (let ci = columnCount - 1; ci >= 0; ci--) {
      if (rows.some(r => !isEmpty(r.cells[ci]?.value ?? ''))) {
        lastCol = ci
        break
      }
    }
    return lastCol < lastCommittedCol
  })

  function findLastRowWithData(): number {
    const isEmpty = isEmptyValue
    for (let ri = rows.length - 1; ri >= (headers ? 1 : 0); ri--) {
      const row = rows[ri]
      if (row && row.cells.some(c => !isEmpty(c.value))) return ri
    }
    return headers ? 0 : -1
  }

  function stripTrailingEmptyRows(matrix: string[][]): string[][] {
    let trimmed = matrix
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].every(v => isEmptyValue(v))) {
      trimmed = trimmed.slice(0, trimmed.length - 1)
    }
    return trimmed
  }

  $effect(() => {
    const input = options.getValue()
    if (pending || matrixEqual(input, lastValue)) return
    // The preview pipeline feeds the grid's own serialized content back as
    // the value prop, and parsing strips trailing all-empty rows that the
    // CSV text format cannot represent. Treat that lossy round-trip as a
    // self-echo so empty rows appended by the grid are not dropped on the
    // next sync.
    if (matrixEqual(input, stripTrailingEmptyRows(lastValue))) return
    rows = input.map(r => ({ id: ++rowId, cells: r.map(v => newCell(v)) }))
    normalize()
    lastValue = input
    resetHistory()
  })

  $effect(() => {
    return () => {
      if (commitTimer) clearTimeout(commitTimer)
      commitTimer = null
    }
  })

  let suppressHistory = false

  function commit() {
    const matrix = committedMatrix()
    if (!suppressHistory && !matrixEqual(matrix, lastValue)) {
      pushUndo(lastValue)
    }
    lastValue = matrix
    pending = false
    options.onChange?.(matrix)
  }

  function pushUndo(snapshot: string[][]) {
    const copy = snapshot.map(r => r.slice())
    const top = undoStack[undoStack.length - 1]
    if (top && matrixEqual(top, copy)) return
    undoStack.push(copy)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
    emitHistory()
  }

  function applySnapshot(snapshot: string[][]) {
    suppressHistory = true
    rows = snapshot.map(r => ({ id: ++rowId, cells: r.map(v => newCell(v)) }))
    normalize()
    commit()
    suppressHistory = false
  }

  function undo(): boolean {
    flushCommit()
    const snapshot = undoStack.pop()
    if (!snapshot) return false
    redoStack.push(currentMatrix())
    applySnapshot(snapshot)
    emitHistory()
    return true
  }

  function redo(): boolean {
    flushCommit()
    const snapshot = redoStack.pop()
    if (!snapshot) return false
    undoStack.push(currentMatrix())
    applySnapshot(snapshot)
    emitHistory()
    return true
  }

  function scheduleCommit() {
    pending = true
    if (commitTimer) clearTimeout(commitTimer)
    commitTimer = setTimeout(() => {
      commitTimer = null
      commit()
    }, 250)
  }

  function flushCommit() {
    if (commitTimer) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
    if (pending) commit()
  }

  function commitImmediate() {
    if (commitTimer) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
    commit()
  }

  function normalize() {
    const cols = colCap ?? (rows.length ? Math.max(...rows.map(r => r.cells.length)) : 0)
    for (const row of rows) {
      while (row.cells.length < cols) row.cells.push(newCell(''))
      if (colCap != null && row.cells.length > colCap) row.cells = row.cells.slice(0, colCap)
    }
  }

  function setValue(ri: number, ci: number, value: string) {
    const cell = rows[ri]?.cells[ci]
    if (!cell) return
    cell.value = value
    cell.committed = true
    scheduleCommit()
  }

  function insertRow(index: number, after: boolean) {
    pruneAllPending()
    let at = after ? index + 1 : index
    if (headers && at === 0 && !after) at = 1
    at = Math.min(Math.max(0, at), rows.length)
    rows.splice(at, 0, newRow(columnCount || 1))
    normalize()
    commitImmediate()
  }

  function removeRowAt(index: number) {
    if (index < 0 || index >= rows.length) return
    if (headers && index === 0) return
    rows.splice(index, 1)
    commitImmediate()
  }

  function deleteRows(indices: Iterable<number>): boolean {
    const toDelete = new Set<number>()
    for (const ri of indices) {
      if (headers && ri === 0) continue
      const row = rows[ri]
      if (row) toDelete.add(row.id)
    }
    if (toDelete.size === 0) return false
    rows = rows.filter(r => !toDelete.has(r.id))
    commitImmediate()
    return true
  }

  function insertColumnAt(col: number) {
    pruneAllPending()
    if (colCap != null && columnCount >= colCap) return
    if (rows.length === 0) rows.push(newRow(colCap ?? 1))
    for (const row of rows) row.cells.splice(col, 0, newCell(''))
    normalize()
    commitImmediate()
  }

  function deleteColumns(indices: Iterable<number>): boolean {
    if (colCap != null) return false
    const cols = [...indices].sort((a, b) => b - a)
    if (!cols.length) return false
    for (const col of cols) {
      if (col < 0 || col >= columnCount) continue
      for (const row of rows) row.cells.splice(col, 1)
    }
    commitImmediate()
    return true
  }

  function appendRow(): number {
    pruneAllPending()
    rows.push(newRow(columnCount || 1))
    normalize()
    commitImmediate()
    return rows.length - 1
  }

  function appendColumn(): number {
    if (colCap != null && columnCount >= colCap) return columnCount - 1
    pruneAllPending()
    if (rows.length === 0) rows.push(newRow(colCap ?? 1))
    for (const row of rows) row.cells.push(newCell(''))
    normalize()
    commitImmediate()
    return columnCount - 1
  }

  // Navigation-driven extension: the appended row/column is rendered but its
  // cells stay uncommitted, so it contributes nothing to the serialized matrix
  // until the user types a value into it.
  function appendPendingRow(): number {
    rows.push(newRow(columnCount || 1, false))
    normalize()
    return rows.length - 1
  }

  function appendPendingColumn(): number {
    if (colCap != null) return columnCount - 1
    if (rows.length === 0) rows.push(newRow(1, false))
    for (const row of rows) row.cells.push(newCell('', false))
    normalize()
    return columnCount - 1
  }

  function pruneTrailingPendingRows(after: number) {
    let end = rows.length - 1
    while (end > after && rows[end]?.cells.every(c => !c.committed)) {
      rows.splice(end, 1)
      end--
    }
  }

  function pruneTrailingPendingColumns(after: number) {
    if (colCap != null) return
    let end = columnCount - 1
    while (end > after && rows.every(r => r.cells[end] && !r.cells[end].committed)) {
      for (const row of rows) row.cells.pop()
      end--
    }
  }

  function pruneAllPending() {
    pruneTrailingPendingRows(-1)
    pruneTrailingPendingColumns(-1)
  }

  function trimTrailingEmptyRows() {
    const last = findLastRowWithData()
    const keepCount = last + 1
    if (keepCount < rows.length) {
      rows = rows.slice(0, keepCount)
      commitImmediate()
    }
  }

  function trimTrailingEmptyColumns() {
    if (colCap != null) return
    const isEmpty = isEmptyValue
    let keepCount = columnCount
    for (let ci = columnCount - 1; ci > 0; ci--) {
      const hasData = rows.some(r => !isEmpty(r.cells[ci]?.value ?? ''))
      if (hasData) break
      keepCount = ci
    }
    if (keepCount < columnCount) {
      for (const row of rows) row.cells = row.cells.slice(0, keepCount)
      commitImmediate()
    }
  }

  function clearValues(keys: Iterable<string>): boolean {
    let changed = false
    for (const key of keys) {
      const [ri, ci] = key.split(':').map(Number)
      const cell = rows[ri]?.cells[ci]
      if (!cell || cell.value === '') continue
      cell.value = ''
      changed = true
    }
    if (changed) scheduleCommit()
    return changed
  }

  function expandMatrix(neededRows: number, neededCols: number) {
    if (colCap != null) neededCols = Math.min(neededCols, colCap)
    while (rows.length < neededRows) {
      rows.push(newRow(Math.max(columnCount, neededCols) || (colCap ?? 1)))
    }
    for (const row of rows) {
      while (row.cells.length < neededCols) row.cells.push(newCell(''))
    }
    normalize()
  }

  function applyPastedText(ri: number, ci: number, text: string) {
    pruneAllPending()
    const pasteLines = text.split(/\r?\n/)
    let neededRows = ri + pasteLines.length
    let neededCols = ci
    for (const line of pasteLines) {
      neededCols = Math.max(neededCols, ci + line.split('\t').length)
    }
    if (colCap != null) neededCols = Math.min(neededCols, colCap)
    expandMatrix(neededRows, neededCols)
    for (let i = 0; i < pasteLines.length; i++) {
      const values = pasteLines[i].split('\t')
      for (let j = 0; j < values.length; j++) {
        if (colCap != null && ci + j >= colCap) break
        const cell = rows[ri + i].cells[ci + j]
        cell.value = values[j]
        cell.committed = true
      }
    }
    scheduleCommit()
  }

  return {
    get rows() {
      return rows
    },
    get columnCount() {
      return columnCount
    },
    get rowCount() {
      return rowCount
    },
    get headers() {
      return headers
    },
    get needsTrim() {
      return needsTrim
    },
    setValue,
    insertRowAt: insertRow,
    removeRowAt,
    deleteRows,
    insertColumnAt,
    deleteColumns,
    appendRow,
    appendColumn,
    appendPendingRow,
    appendPendingColumn,
    pruneTrailingPendingRows,
    pruneTrailingPendingColumns,
    trimTrailingEmptyRows,
    trimTrailingEmptyColumns,
    clearValues,
    applyPastedText,
    scheduleCommit,
    flushCommit,
    commitImmediate,
    undo,
    redo,
    onHistory,
    get canUndo() {
      return canUndo
    },
    get canRedo() {
      return canRedo
    },
    matrix(): string[][] {
      return committedMatrix()
    },
  }
}