import { clearColumnWidths, loadColumnWidths, saveColumnWidths } from '$lib/column-width-storage'

// Shared column-resize engine for tables that render resizable columns via a
// fixed-layout `<colgroup>` (DataGrid and DataTable). Each data column is
// bounded by two splitters: a mid-column splitter re-partitions its two
// adjacent columns within a fixed combined total (both kept above their
// minimum), and the trailing splitter moves the table's right edge.
//
// The consuming component owns the reactive `columnWidths` array (via
// `getColumnWidths`/`setColumnWidths`) so it can render the `<colgroup>`; the
// engine holds the transient drag state and drives the width math.

export interface ColumnResizeConfig {
  getColumnCount: () => number
  getContainer: () => HTMLElement | null
  getColumnWidths: () => number[]
  setColumnWidths: (widths: number[]) => void
  getColumnCellWidth: (i: number) => number
  getMinWidth: (i: number) => number
  // Fixed width reserved beside the data columns (row-number column + border in
  // the grid, checkbox column in the admin table).
  getFillWidthOffset: () => number
  getStorageKey: () => string | undefined
}

export function createColumnResize(config: ColumnResizeConfig) {
  const {
    getColumnCount,
    getContainer,
    getColumnWidths,
    setColumnWidths,
    getColumnCellWidth,
    getMinWidth,
    getFillWidthOffset,
    getStorageKey,
  } = config

  let resizingCol = $state<number | null>(null)
  let resizeStartX = 0
  let resizeStartWidth = 0
  // Fixed combined width of the two adjacent columns being re-partitioned, or
  // null when resizing the last column's right edge (table edge).
  let resizeSiblingTotal: number | null = null
  // Frame-throttled drag state: only the latest pointer X is applied per
  // animation frame so mousemove bursts don't thrash layout.
  let pendingResizeFrame = false
  let latestResizeX = 0

  const widths = () => getColumnWidths()

  function captureAllWidths(): number[] {
    const result: number[] = []
    for (let i = 0; i < getColumnCount(); i++) {
      result.push(widths()[i] ?? getColumnCellWidth(i))
    }
    return result
  }

  function startColumnResize(event: MouseEvent, ci: number) {
    event.preventDefault()
    event.stopPropagation()
    resizingCol = ci
    resizeStartX = event.clientX
    const captured = captureAllWidths()
    resizeStartWidth = captured[ci]
    resizeSiblingTotal = ci < getColumnCount() - 1 ? captured[ci] + captured[ci + 1] : null
    setColumnWidths(captured)
  }

  function applyResizeDiff(diff: number) {
    if (resizingCol === null) return
    const i = resizingCol
    if (resizeSiblingTotal != null) {
      const newWidth = Math.max(
        getMinWidth(i),
        Math.min(resizeSiblingTotal - getMinWidth(i + 1), resizeStartWidth + diff),
      )
      widths()[i] = newWidth
      widths()[i + 1] = resizeSiblingTotal - newWidth
    } else {
      // Trailing splitter: moves the table's right edge. Expanding right grows
      // the table beyond the container (horizontal scroll). Shrinking left
      // shrinks the last column while the table overflows; once the table would
      // fit the container, further left drags absorb the shortfall in the
      // previous column, so the previous splitter moves right and the table's
      // minimum width stays the container width.
      let newWidth = Math.max(getMinWidth(i), resizeStartWidth + diff)
      const container = getContainer()
      if (newWidth < resizeStartWidth && container) {
        let others = 0
        for (let j = 0; j < getColumnCount(); j++) {
          if (j !== i) others += widths()[j]
        }
        const fillWidth = Math.max(getMinWidth(i), container.clientWidth - getFillWidthOffset() - others)
        if (newWidth < fillWidth && i > 0) {
          // The table would shrink below the container: grow the previous
          // column by the shortfall so the trailing splitter stays anchored at
          // the container's right edge (the previous splitter moves right).
          widths()[i - 1] += fillWidth - newWidth
        } else {
          newWidth = Math.max(newWidth, Math.min(fillWidth, resizeStartWidth))
        }
      }
      widths()[i] = newWidth
    }
  }

  function handleResizeMouseMove(event: MouseEvent) {
    if (resizingCol === null) return
    latestResizeX = event.clientX
    if (pendingResizeFrame) return
    pendingResizeFrame = true
    requestAnimationFrame(() => {
      pendingResizeFrame = false
      if (resizingCol === null) return
      applyResizeDiff(latestResizeX - resizeStartX)
      keepTrailingSplitterVisible()
    })
  }

  // While dragging the trailing splitter right, the table grows beyond the
  // container and the splitter would scroll out of view. Keep it pinned at the
  // container's right edge by scrolling the wrapper fully right (the grid's
  // header wrapper mirrors that scroll). The scroll is applied in a nested
  // animation frame so the new column widths have been flushed to the layout.
  function keepTrailingSplitterVisible() {
    const body = getContainer()
    if (!body || resizingCol !== getColumnCount() - 1) return
    requestAnimationFrame(scrollTrailingSplitterIntoView)
  }

  // Pin the trailing splitter at the container's right edge after the new
  // column widths have been flushed to layout.
  function scrollTrailingSplitterIntoView() {
    const body = getContainer()
    if (!body) return
    const maxScroll = body.scrollWidth - body.clientWidth
    if (maxScroll > body.scrollLeft) {
      body.scrollLeft = maxScroll
    }
  }

  function handleResizeKeydown(event: KeyboardEvent, ci: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const captured = captureAllWidths()
    setColumnWidths(captured)
    resizingCol = ci
    resizeStartWidth = captured[ci]
    resizeSiblingTotal = ci < getColumnCount() - 1 ? captured[ci] + captured[ci + 1] : null
    applyResizeDiff(event.key === 'ArrowRight' ? 10 : -10)
    keepTrailingSplitterVisible()
    resizingCol = null
  }

  function handleResizeMouseUp() {
    const trailing = resizingCol === getColumnCount() - 1
    resizingCol = null
    pendingResizeFrame = false
    // The last keepTrailingSplitterVisible frame may have been skipped once
    // resizingCol cleared; settle the trailing splitter at the right edge.
    if (trailing) {
      requestAnimationFrame(scrollTrailingSplitterIntoView)
    }
  }

  // Restore persisted widths when their layout matches the current grid.
  // Storage is read once and re-read whenever the column count changes, so a
  // grid that mounts before its columns are known (a length mismatch) still
  // restores the saved layout once the count lines up, and a stale layout from
  // a previous column count is never returned. Consumers can assign the result
  // from a setup $effect without a local once-flag.
  let persistedWidths: number[] | null = null
  let persistedCount = -1
  function loadPersistedWidths(): number[] | null {
    const count = getColumnCount()
    if (persistedCount !== count) {
      const storageKey = getStorageKey()
      const stored = storageKey ? loadColumnWidths(storageKey) : null
      persistedWidths = stored && stored.length === count ? stored : null
      persistedCount = count
    }
    return persistedWidths
  }

  // Drop the persisted widths so a width reset (or a cleared table) never
  // restores them on the next mount. Resetting the cached count makes a later
  // load in the same session re-read storage, and cancelling the pending write
  // stops an armed debounce from saving the pre-reset widths back.
  function clearPersistedWidths(): void {
    const storageKey = getStorageKey()
    if (storageKey) clearColumnWidths(storageKey)
    persistedWidths = null
    persistedCount = -1
    cancelSave()
  }

  // Persist resized column widths so the user's splitter positions survive a
  // reload. The write is debounced because an in-flight drag re-partitions the
  // widths every animation frame; the pending write is flushed when the effect
  // tears down so the final drag still lands.
  const SAVE_DEBOUNCE_MS = 200
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingSave: { key: string; widths: number[] } | null = null

  function cancelSave() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    pendingSave = null
  }

  function flushSave() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (pendingSave === null) return
    const { key, widths: w } = pendingSave
    pendingSave = null
    saveColumnWidths(key, w)
    // Keep the restore cache in step with what was just saved, so a later load
    // for the same column count returns the current widths instead of the
    // pre-drag layout captured at mount.
    persistedWidths = w
    persistedCount = w.length
  }

  $effect(() => {
    const storageKey = getStorageKey()
    const w = widths()
    if (!storageKey || w.length === 0) {
      cancelSave()
      return
    }
    pendingSave = { key: storageKey, widths: w.slice() }
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  })

  $effect(() => () => flushSave())

  return {
    startColumnResize,
    handleResizeMouseMove,
    handleResizeKeydown,
    handleResizeMouseUp,
    loadPersistedWidths,
    clearPersistedWidths,
  }
}
