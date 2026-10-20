import type { createGridModel } from './use-grid-model.svelte'

type Model = ReturnType<typeof createGridModel>

// The grid's column-sort controller: which column the data is sorted by, the
// direction, and the snapshot that invalidates the indicator when that column's
// values change. The reorder itself is delegated to the model's `sortRows` so it
// participates in undo/redo.
export function createGridSort(model: Model) {
  let sortColumn = $state<number | null>(null)
  let sortDirection = $state<'asc' | 'desc'>('asc')
  // Snapshot of the sort column's values captured when the sort was applied.
  // Any change in that column clears the active sort indicator.
  let sortSnapshot = $state<string[] | null>(null)

  function columnValues(ci: number): string[] {
    return model.rows.map(r => r.cells[ci]?.value ?? '')
  }

  $effect(() => {
    const ci = sortColumn
    const snapshot = sortSnapshot
    if (ci == null || snapshot == null) return
    const current = columnValues(ci)
    const same = current.length === snapshot.length && current.every((v, i) => v === snapshot[i])
    if (!same) {
      sortColumn = null
      sortDirection = 'asc'
      sortSnapshot = null
    }
  })

  function handleSortClick(ci: number, direction: 'asc' | 'desc' = 'asc') {
    sortColumn = ci
    sortDirection = direction
    model.sortRows(ci, direction)
    sortSnapshot = columnValues(ci)
  }

  return {
    get sortColumn() {
      return sortColumn
    },
    get sortDirection() {
      return sortDirection
    },
    handleSortClick,
  }
}
