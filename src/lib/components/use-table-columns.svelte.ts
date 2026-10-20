import { createColumnResize } from './use-column-resize.svelte'
import { realignColumnWidths } from '$lib/data-table/column-helpers'

// The minimal column shape the width engine reads; any DataTableColumn
// satisfies it structurally.
export interface TableColumnWidthSpec {
  key: string
  width?: string | number
  minWidth?: string | number
}

export const TABLE_MIN_COLUMN_WIDTH = 60
export const TABLE_SELECT_COLUMN_WIDTH = 40
// Width for a newly shown column when its declared percentage share cannot be
// resolved, matching the old fixed default.
const ADDED_COLUMN_FALLBACK_WIDTH = 128

export interface TableColumnsOptions {
  getColumns: () => TableColumnWidthSpec[]
  // Enables managed pixel widths (the `resizable` prop).
  getResizable: () => boolean
  // Whether the fixed selection column is rendered (offsets the fill width).
  getSelectable: () => boolean
  getStorageKey: () => string | undefined
  // Rising signal from the column chooser's reset action; each new value drops
  // managed widths and their persisted copy.
  getResetSignal: () => number
  getContainer: () => HTMLElement | null
  getColumnCellWidth: (i: number) => number
  // When the visible column set shrinks, drops header element refs past `count`
  // so a detached header's width is never served.
  pruneHeaderRefs: (count: number) => void
}

// DataTable's column-width engine: the managed pixel widths (aligned by column
// key), the persisted copy, the reset signal, and the shared resize composable.
// The component keeps the DOM refs and passes them in through getters.
export function createTableColumns(options: TableColumnsOptions) {
  // Pixel width per data column; empty until the first resize.
  let columnWidths = $state<number[]>([])
  // Column keys the widths above belong to. Widths are realigned by key (not
  // position) whenever the visible set changes, so toggling a column never
  // shifts its neighbours' widths.
  let widthKeys = $state<string[]>([])

  const managedWidths = $derived(options.getResizable() && columnWidths.length > 0)

  const totalWidth = $derived.by(() => {
    let sum = options.getSelectable() ? TABLE_SELECT_COLUMN_WIDTH : 0
    const columns = options.getColumns()
    for (let i = 0; i < columns.length; i++) {
      sum += columnWidths[i] ?? 0
    }
    return sum
  })

  function columnMinWidth(i: number): number {
    const mw = options.getColumns()[i]?.minWidth
    return typeof mw === 'number' && Number.isFinite(mw) && mw >= 0 ? mw : TABLE_MIN_COLUMN_WIDTH
  }

  // Width for a newly shown column: its declared percentage share of the
  // rendered table, so it comes back at the size the % layout would give it.
  function addedColumnWidth(key: string): number {
    const columns = options.getColumns()
    const index = columns.findIndex(c => c.key === key)
    const declared = columns[index]?.width
    const pct = typeof declared === 'string' && declared.endsWith('%') ? Number.parseFloat(declared) : NaN
    const basis = options.getContainer()?.clientWidth ?? columnWidths.reduce((sum, w) => sum + w, 0)
    const computed = !Number.isNaN(pct) && basis > 0 ? Math.round((basis * pct) / 100) : ADDED_COLUMN_FALLBACK_WIDTH
    return Math.max(computed, index >= 0 ? columnMinWidth(index) : TABLE_MIN_COLUMN_WIDTH)
  }

  const resize = createColumnResize({
    getColumnCount: () => options.getColumns().length,
    getContainer: options.getContainer,
    getColumnWidths: () => columnWidths,
    setColumnWidths: (widths: number[]) => {
      columnWidths = widths
    },
    getColumnCellWidth: options.getColumnCellWidth,
    getMinWidth: columnMinWidth,
    getFillWidthOffset: () => (options.getSelectable() ? TABLE_SELECT_COLUMN_WIDTH : 0),
    getStorageKey: options.getStorageKey,
  })

  // Keep columnWidths aligned with the current columns while the table is in
  // managed mode. Alignment is by column key: widths captured or restored
  // without keys are adopted only when they line up with the current columns,
  // and anything stale falls back to the % layout.
  $effect(() => {
    const keys = options.getColumns().map(c => c.key)
    const count = keys.length
    options.pruneHeaderRefs(count)
    if (count === 0) return
    if (columnWidths.length === 0) {
      if (widthKeys.length > 0) widthKeys = []
      return
    }
    if (widthKeys.length === 0) {
      if (columnWidths.length === count) widthKeys = keys
      else columnWidths = []
      return
    }
    if (widthKeys.length === count && widthKeys.every((k, i) => k === keys[i])) return
    columnWidths = realignColumnWidths(keys, widthKeys, columnWidths, addedColumnWidth)
    widthKeys = keys
  })

  // Restore persisted column widths on mount so the user's splitter positions
  // survive a reload. loadPersistedWidths re-reads storage when the column count
  // changes and returns the saved layout only when its width matches, so this
  // assignment re-runs on a count change and a matching layout exists.
  $effect(() => {
    const persisted = resize.loadPersistedWidths()
    if (persisted != null) columnWidths = persisted
  })

  // Width reset from the column chooser: forget manual adjustments in memory
  // and in storage. The realign effect above then sees empty widths and the
  // table renders the percentage layout again.
  let lastWidthReset = 0
  $effect(() => {
    const reset = options.getResetSignal()
    if (reset === lastWidthReset) return
    lastWidthReset = reset
    columnWidths = []
    widthKeys = []
    resize.clearPersistedWidths()
  })

  return {
    get columnWidths() {
      return columnWidths
    },
    get managedWidths() {
      return managedWidths
    },
    get totalWidth() {
      return totalWidth
    },
    resize,
  }
}
