import { isEmptyValue } from './grid-utils'
import type { GridRow } from './use-grid-model.svelte'

// The grid's committed-matrix view: which rows/columns are authored, where the
// serialized matrix ends, and whether trailing empties can be trimmed. Kept
// apart from the row model so the model owns mutation while this composable owns
// the derived matrix bounds.
export interface GridSerializeOptions {
  getRows: () => GridRow[]
  getColumnCount: () => number
  getHeaders: () => boolean
  maxColumns?: number
}

export function createGridSerialize(options: GridSerializeOptions) {
  const colCap = options.maxColumns

  function findLastRowWithData(): number {
    const rows = options.getRows()
    const headers = options.getHeaders()
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

  const lastCommittedRow = $derived.by(() => {
    const rows = options.getRows()
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      if (rows[ri].cells.some(c => c.committed)) return ri
    }
    return -1
  })

  const lastCommittedCol = $derived.by(() => {
    const rows = options.getRows()
    const columnCount = options.getColumnCount()
    for (let ci = columnCount - 1; ci >= 0; ci--) {
      if (rows.some(r => r.cells[ci]?.committed)) return ci
    }
    return -1
  })

  const needsTrim = $derived.by(() => {
    const rows = options.getRows()
    const rowCount = rows.length
    const columnCount = options.getColumnCount()
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

  // The serialized matrix bounds itself to the last row/column that has any
  // authored (committed) cell, so rows/columns appended by pure navigation and
  // never typed into stay out of the document until a value is entered.
  function committedMatrix(): string[][] {
    const rows = options.getRows()
    const cols = lastCommittedCol + 1
    const rowsCount = lastCommittedRow + 1
    if (rowsCount <= 0 || cols <= 0) return []
    return rows.slice(0, rowsCount).map(r => r.cells.slice(0, cols).map(c => c.value))
  }

  return {
    get needsTrim() {
      return needsTrim
    },
    committedMatrix,
    findLastRowWithData,
    stripTrailingEmptyRows,
  }
}
