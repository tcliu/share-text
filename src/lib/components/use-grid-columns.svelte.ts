import { createColumnResize } from './use-column-resize.svelte'

// The grid's column-width engine: initial/auto width resolution, the
// container-resize rescale, column-count reconciliation, and the shared resize
// composable. Owned by DataGrid through `createGridColumns` so the component
// keeps only presentation.
export interface GridColumnsOptions {
  getColumnCount: () => number
  getContainer: () => HTMLElement | null
  // The element whose resize re-fits columns (the grid root, not the body
  // scroll wrapper): a body scrollbar must not collapse an overflowing table.
  getViewport: () => HTMLElement | null
  getColumnCellWidth: (ci: number) => number
  getInitialColumnWidths: () => string[] | undefined
  getStorageKey: () => string | undefined
}

const ROW_NUMBER_WIDTH = 36
const MIN_COLUMN_WIDTH = 60
// Width given to a freshly inserted column in managed mode, matching the
// auto-width `min-w-32` floor.
const DEFAULT_COLUMN_WIDTH = 128
// The table carries a 1px border-l (the grid's outer left edge), so the columns
// sum to one pixel less than the container to keep the border box inside the
// scroll area.
const TABLE_LEFT_BORDER = 1

export function createGridColumns(options: GridColumnsOptions) {
  const columnCount = () => options.getColumnCount()

  // Column widths in pixels. Empty array means auto-width (min-w-32 fallback).
  let columnWidths = $state<number[]>([])
  let autoColumnWidths = $state<number[]>([])

  // Resolve initialColumnWidths to per-column pixels. Every column (including
  // the last) gets an explicit width; the last column absorbs the exact
  // remainder of the available width so the table never overflows the container
  // on initial render.
  function resolveInitialWidths(): number[] {
    const available = Math.max(0, (options.getContainer()?.clientWidth ?? 0) - ROW_NUMBER_WIDTH - TABLE_LEFT_BORDER)
    const widths: number[] = []
    let sum = 0
    for (let i = 0; i < columnCount(); i++) {
      const spec = options.getInitialColumnWidths()?.[i]
      let w: number
      if (spec?.endsWith('%')) {
        w = Math.round((parseFloat(spec) / 100) * available)
      } else if (spec) {
        w = parseFloat(spec) || 128
      } else {
        w = 128
      }
      if (i < columnCount() - 1) {
        const clamped = Math.max(MIN_COLUMN_WIDTH, w)
        widths.push(clamped)
        sum += clamped
      } else {
        widths.push(Math.max(MIN_COLUMN_WIDTH, available - sum))
      }
    }
    return widths
  }

  function equalWidths(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }

  function resolveAutoWidths(): number[] {
    const count = columnCount()
    if (count === 0) return []
    const available = Math.max(
      MIN_COLUMN_WIDTH * count,
      (options.getContainer()?.clientWidth ?? options.getViewport()?.clientWidth ?? 0) -
        ROW_NUMBER_WIDTH -
        TABLE_LEFT_BORDER,
    )
    const base = Math.max(MIN_COLUMN_WIDTH, Math.floor(available / count))
    const widths = Array.from({ length: count }, () => base)
    widths[count - 1] = Math.max(MIN_COLUMN_WIDTH, available - base * (count - 1))
    return widths
  }

  const resize = createColumnResize({
    getColumnCount: columnCount,
    getContainer: options.getContainer,
    getColumnWidths: () => columnWidths,
    setColumnWidths: (widths: number[]) => {
      columnWidths = widths
    },
    getColumnCellWidth: options.getColumnCellWidth,
    getMinWidth: () => MIN_COLUMN_WIDTH,
    getFillWidthOffset: () => TABLE_LEFT_BORDER + ROW_NUMBER_WIDTH,
    getStorageKey: options.getStorageKey,
  })

  $effect(() => {
    if (!options.getContainer()) return
    const persisted = resize.loadPersistedWidths()
    if (persisted != null) {
      columnWidths = persisted
    } else if (columnWidths.length === 0 && options.getInitialColumnWidths()?.length) {
      const resolved = resolveInitialWidths()
      if (resolved.length > 0) columnWidths = resolved
    }
  })

  $effect(() => {
    if (columnWidths.length > 0) {
      autoColumnWidths = []
      return
    }
    const resolved = resolveAutoWidths()
    if (!equalWidths(autoColumnWidths, resolved)) {
      autoColumnWidths = resolved
    }
  })

  // Rescale every column proportionally so the table fills the container when it
  // can, mirroring the two-table reference's container resize: the target usable
  // width is `max(minimum × count, container − rownum − border)`, so a container
  // too narrow to fit even the minimum-width columns keeps the table overflowing
  // (horizontal scroll preserved) instead of squeezing it. The last column then
  // absorbs the exact remainder so the table fills edge-to-edge. Auto-width grids
  // (no explicit widths) are left alone.
  function rescaleToContainer() {
    const available = Math.max(
      MIN_COLUMN_WIDTH * columnCount(),
      (options.getContainer()?.clientWidth ?? 0) - ROW_NUMBER_WIDTH - TABLE_LEFT_BORDER,
    )
    let total = 0
    for (let i = 0; i < columnCount(); i++) total += columnWidths[i]
    if (total <= 0) return
    const last = columnCount() - 1
    const next: number[] = []
    for (let i = 0; i < columnCount(); i++) {
      if (i === last) {
        next.push(columnWidths[i])
      } else {
        next.push(Math.max(MIN_COLUMN_WIDTH, Math.round((columnWidths[i] / total) * available)))
      }
    }
    let used = 0
    for (let i = 0; i < last; i++) used += next[i]
    next[last] = Math.max(MIN_COLUMN_WIDTH, available - used)
    columnWidths = next
  }

  // Re-fit columns only when the outer viewport resizes (e.g. the pane
  // splitter), never when the body wrapper's own scrollbar appears — that would
  // immediately collapse an intentionally overflowing table into a fitted one.
  $effect(() => {
    const viewport = options.getViewport()
    if (!viewport) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (columnWidths.length > 0) {
        rescaleToContainer()
        return
      }
      const resolved = resolveAutoWidths()
      if (!equalWidths(autoColumnWidths, resolved)) {
        autoColumnWidths = resolved
      }
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  })

  // Keep columnWidths aligned with the current column count whenever the grid
  // structure changes in managed mode (e.g. columns inserted/removed). A newly
  // inserted column gets a fixed default width — never a live measurement, since
  // mid-effect its cells render at 0px (the fixed-layout table width hasn't been
  // updated yet) and would pin the column invisible. After a removal the
  // surviving columns are rescaled to refill the container, so a deleted column
  // never leaves a gap at the table's right edge.
  $effect(() => {
    const count = columnCount()
    if (columnWidths.length === count) return
    if (count === 0) return
    if (columnWidths.length === 0 && options.getInitialColumnWidths()?.length) {
      columnWidths = resolveInitialWidths()
      return
    }
    if (columnWidths.length === 0) return
    const removed = columnWidths.length > count
    const next: number[] = []
    for (let i = 0; i < count; i++) {
      next.push(columnWidths[i] ?? DEFAULT_COLUMN_WIDTH)
    }
    columnWidths = next
    if (removed) rescaleToContainer()
  })

  // True when any column has an explicit pixel width, switching the table to
  // fixed layout so each sized column keeps its exact width.
  const managedWidths = $derived(columnWidths.length > 0)
  const renderedColumnWidths = $derived(managedWidths ? columnWidths : autoColumnWidths)

  // Total table width: row-number column plus all data columns.
  const totalWidth = $derived.by(() => {
    let sum = ROW_NUMBER_WIDTH
    for (let i = 0; i < columnCount(); i++) {
      sum += renderedColumnWidths[i] ?? 0
    }
    return sum
  })

  function columnWidthStyle(ci: number): string {
    const w = renderedColumnWidths[ci]
    if (w == null) return ''
    return `width:${w}px;min-width:${w}px;`
  }

  return {
    get managedWidths() {
      return managedWidths
    },
    get renderedColumnWidths() {
      return renderedColumnWidths
    },
    get totalWidth() {
      return totalWidth
    },
    columnWidthStyle,
    resize,
  }
}
