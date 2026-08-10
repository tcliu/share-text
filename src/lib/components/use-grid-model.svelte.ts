import { isEmptyValue, matrixEqual } from './grid-utils'

interface Cell {
  id: number
  value: string
}
interface Row {
  id: number
  cells: Cell[]
}

export interface GridModelOptions {
  getValue: () => string[][]
  getHeaders: () => boolean
  onChange?: (rows: string[][]) => void
}

export function createGridModel(options: GridModelOptions) {
  let cellId = 0
  let rowId = 0
  const newCell = (value = ''): Cell => ({ id: ++cellId, value })
  const newRow = (cols: number): Row => ({
    id: ++rowId,
    cells: Array.from({ length: cols }, () => newCell('')),
  })

  let rows = $state<Row[]>([])
  let lastValue: string[][] = []
  let pending = false
  let commitTimer: ReturnType<typeof setTimeout> | null = null

  const columnCount = $derived(rows.length ? Math.max(...rows.map(r => r.cells.length)) : 0)
  const rowCount = $derived(rows.length)
  const headers = $derived(options.getHeaders())

  const needsTrim = $derived.by(() => {
    if (rowCount === 0) return false
    const isEmpty = isEmptyValue
    const lastRow = findLastRowWithData()
    if (rowCount - 1 - lastRow > 0) return true
    let lastCol = -1
    for (let ci = columnCount - 1; ci >= 0; ci--) {
      if (rows.some(r => !isEmpty(r.cells[ci]?.value ?? ''))) {
        lastCol = ci
        break
      }
    }
    return columnCount - 1 - lastCol > 0
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
  })

  $effect(() => {
    return () => {
      if (commitTimer) clearTimeout(commitTimer)
      commitTimer = null
    }
  })

  function commit() {
    const matrix = rows.map(r => r.cells.map(c => c.value))
    lastValue = matrix
    pending = false
    options.onChange?.(matrix)
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
    const cols = rows.length ? Math.max(...rows.map(r => r.cells.length)) : 0
    for (const row of rows) while (row.cells.length < cols) row.cells.push(newCell(''))
  }

  function setValue(ri: number, ci: number, value: string) {
    const cell = rows[ri]?.cells[ci]
    if (!cell) return
    cell.value = value
    scheduleCommit()
  }

  function insertRow(index: number, after: boolean) {
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
    if (rows.length === 0) rows.push(newRow(1))
    for (const row of rows) row.cells.splice(col, 0, newCell(''))
    normalize()
    commitImmediate()
  }

  function deleteColumns(indices: Iterable<number>): boolean {
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
    rows.push(newRow(columnCount || 1))
    normalize()
    commitImmediate()
    return rows.length - 1
  }

  function appendColumn(): number {
    if (rows.length === 0) rows.push(newRow(1))
    for (const row of rows) row.cells.push(newCell(''))
    normalize()
    commitImmediate()
    return columnCount - 1
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
    while (rows.length < neededRows) {
      rows.push(newRow(Math.max(columnCount, neededCols) || 1))
    }
    for (const row of rows) {
      while (row.cells.length < neededCols) row.cells.push(newCell(''))
    }
    normalize()
  }

  function applyPastedText(ri: number, ci: number, text: string) {
    const pasteLines = text.split(/\r?\n/)
    let neededRows = ri + pasteLines.length
    let neededCols = ci
    for (const line of pasteLines) {
      neededCols = Math.max(neededCols, ci + line.split('\t').length)
    }
    expandMatrix(neededRows, neededCols)
    for (let i = 0; i < pasteLines.length; i++) {
      const values = pasteLines[i].split('\t')
      for (let j = 0; j < values.length; j++) {
        rows[ri + i].cells[ci + j].value = values[j]
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
    trimTrailingEmptyRows,
    trimTrailingEmptyColumns,
    clearValues,
    applyPastedText,
    scheduleCommit,
    flushCommit,
    commitImmediate,
    matrix(): string[][] {
      return rows.map(r => r.cells.map(c => c.value))
    },
  }
}