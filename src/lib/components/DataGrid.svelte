<script lang="ts">
  import { tick } from 'svelte'
  import Button from './Button.svelte'
  import { createGridModel } from './use-grid-model.svelte'
  import { createGridSelection, createInitialSelectionState } from './use-grid-selection.svelte'
  import { createGridClipboard } from './use-grid-clipboard'
  import { createAutoScroll } from './use-grid-autoscroll.svelte'
  import { columnLetter } from './grid-utils'

  interface Props {
    value?: string[][]
    onChange?: (rows: string[][]) => void
    showHeaders?: boolean
    testId?: string
    // Locks the grid to a fixed number of columns (e.g. key/value pairs): column
    // insert/delete is disabled and navigation/paste cannot grow past it.
    maxColumns?: number
    // Optional display labels for the column-selector header cells, replacing
    // the column letters (e.g. ['Key', 'Value']).
    columnLabels?: string[]
    // Hides the "Toggle header" toolbar button (e.g. Properties grids never
    // treat the first row as a header, so the toggle is meaningless there).
    hideHeaderToggle?: boolean
    // Initial column widths. Percentage strings (e.g. ['30%', '70%']) are
    // resolved against the available container width and recalculated on
    // resize. px values (e.g. ['200', '400']) or bare numbers are used as-is.
    // When omitted, columns use auto-width with min-w-32.
    initialColumnWidths?: string[]
  }

  let {
    value = [],
    onChange,
    showHeaders = $bindable(true),
    testId = 'data-grid',
    maxColumns,
    columnLabels,
    hideHeaderToggle = false,
    initialColumnWidths,
  }: Props = $props()

  const model = createGridModel({
    getValue: () => value,
    getHeaders: () => showHeaders,
    onChange: (m) => onChange?.(m),
    // Column cap is fixed config captured at grid creation.
    // svelte-ignore state_referenced_locally
    maxColumns,
  })

  const ROW_NUMBER_WIDTH = 36
  const MIN_COLUMN_WIDTH = 60

  // Column widths in pixels. Empty array means auto-width (min-w-32 fallback).
  let columnWidths = $state<number[]>([])

  let gridContainer: HTMLElement | null = null
  let userResized = false

  let initializedWidths = false

  // Resolve initialColumnWidths to per-column pixels. Every column (including
  // the last) gets an explicit width; the last column absorbs the exact
  // remainder of the available width so the table never overflows the
  // container on initial render.
  // The table carries a 1px border-l (the grid's outer left edge), so the
  // columns sum to one pixel less than the container to keep the border box
  // inside the scroll area.
  const TABLE_LEFT_BORDER = 1
  function resolveInitialWidths(): number[] {
    const available = Math.max(
      0,
      (gridContainer?.clientWidth ?? 0) - ROW_NUMBER_WIDTH - TABLE_LEFT_BORDER,
    )
    const widths: number[] = []
    let sum = 0
    for (let i = 0; i < model.columnCount; i++) {
      const spec = initialColumnWidths?.[i]
      let w: number
      if (spec?.endsWith('%')) {
        w = Math.round((parseFloat(spec) / 100) * available)
      } else if (spec) {
        w = parseFloat(spec) || 128
      } else {
        w = 128
      }
      if (i < model.columnCount - 1) {
        const clamped = Math.max(MIN_COLUMN_WIDTH, w)
        widths.push(clamped)
        sum += clamped
      } else {
        widths.push(Math.max(MIN_COLUMN_WIDTH, available - sum))
      }
    }
    return widths
  }

  $effect(() => {
    if (!gridContainer || initializedWidths) return
    initializedWidths = true
    columnWidths = initialColumnWidths?.length ? resolveInitialWidths() : []
  })

  let editSnapshot: { ri: number; ci: number; value: string; committed: boolean } = {
    ri: -1,
    ci: -1,
    value: '',
    committed: true,
  }

  function cellInputEl(ri: number, ci: number): HTMLInputElement | null {
    return gridContainer?.querySelector<HTMLInputElement>(`input[data-row="${ri}"][data-col="${ci}"]`) ?? null
  }

  const focus = {
    cellBox(ri: number, ci: number) { cellInputEl(ri, ci)?.closest<HTMLElement>('td, th')?.focus() },
    cellInput(ri: number, ci: number) { cellInputEl(ri, ci)?.focus() },
    cellInputAtEnd(ri: number, ci: number) {
      tick().then(() => {
        const input = cellInputEl(ri, ci)
        if (input) {
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
      })
    },
    cellInputSelectAll(ri: number, ci: number) {
      tick().then(() => {
        const input = cellInputEl(ri, ci)
        if (input) {
          input.focus()
          input.setSelectionRange(0, input.value.length)
        }
      })
    },
    startEdit(ri: number, ci: number, value: string) {
      model.setValue(ri, ci, value)
      cellInputEl(ri, ci)?.focus()
    },
    rowSelector(ri: number) { gridContainer?.querySelector<HTMLElement>(`[data-row-selector="${ri}"]`)?.focus() },
    columnSelector(ci: number) { gridContainer?.querySelector<HTMLElement>(`[data-col-selector="${ci}"]`)?.focus() },
    isCellInputFocused(ri: number, ci: number) { return document.activeElement === cellInputEl(ri, ci) },
  }

  const clipboard = createGridClipboard()
  const selState = $state(createInitialSelectionState())
  const sel = createGridSelection({ model, focus, clipboard, state: selState })

  let historyState = $state({ canUndo: false, canRedo: false })
  $effect(() => {
    return model.onHistory(state => {
      historyState = state
    })
  })

  function restoreFocusAfterHistoryChange() {
    const cell = sel.selectedCell
    tick().then(() => {
      if (cell && model.rows[cell.ri]?.cells[cell.ci]) focus.cellBox(cell.ri, cell.ci)
    })
  }

  function handleHistoryKeydown(event: KeyboardEvent) {
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
  const autoScroll = createAutoScroll({
    getContainer: () => gridContainer,
    isDragging: sel.isDragging,
    onCellHover: (ri, ci) => sel.handleCellMouseOver(ri, ci),
    onRowHover: (ri) => sel.handleRowSelectorMouseOver(ri),
    onColHover: (ci) => sel.handleColumnSelectorMouseOver(ci),
  })

  $effect(() => () => autoScroll.stop())

  // --- Column resize ---
  //
  // Each data column is bounded by two splitters. Dragging the splitter between
  // columns ci and ci+1 re-partitions those two adjacent columns, keeping the
  // outer splitters (and therefore all other columns) fixed. The splitter after
  // the last column moves the table's right edge instead.

  let resizingCol = $state<number | null>(null)
  let resizeStartX = $state(0)
  let resizeStartWidth = $state(0)
  // Fixed combined width of the two adjacent columns being re-partitioned, or
  // null when resizing the last column's right edge (table edge).
  let resizeSiblingTotal = $state<number | null>(null)

  function getColumnCellWidth(ci: number): number {
    const cell = gridContainer?.querySelector<HTMLElement>(`[data-col-selector="${ci}"]`)
    return cell?.offsetWidth ?? 128
  }

  function captureAllWidths(): number[] {
    const widths: number[] = []
    for (let i = 0; i < model.columnCount; i++) {
      widths.push(columnWidths[i] ?? getColumnCellWidth(i))
    }
    return widths
  }

  function startColumnResize(event: MouseEvent, ci: number) {
    event.preventDefault()
    event.stopPropagation()
    resizingCol = ci
    resizeStartX = event.clientX
    const widths = captureAllWidths()
    resizeStartWidth = widths[ci]
    resizeSiblingTotal =
      ci < model.columnCount - 1 ? widths[ci] + widths[ci + 1] : null
    columnWidths = widths
    userResized = true
  }

  function applyResizeDiff(diff: number) {
    if (resizingCol === null) return
    if (resizeSiblingTotal != null) {
      const newWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(resizeSiblingTotal - MIN_COLUMN_WIDTH, resizeStartWidth + diff),
      )
      columnWidths[resizingCol] = newWidth
      columnWidths[resizingCol + 1] = resizeSiblingTotal - newWidth
    } else {
      let newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth + diff)
      if (newWidth < resizeStartWidth && gridContainer) {
        let others = 0
        for (let i = 0; i < model.columnCount; i++) {
          if (i !== resizingCol) others += columnWidths[i]
        }
        const fillWidth = Math.max(
          MIN_COLUMN_WIDTH,
          gridContainer.clientWidth - TABLE_LEFT_BORDER - ROW_NUMBER_WIDTH - others,
        )
        newWidth = Math.max(newWidth, Math.min(fillWidth, resizeStartWidth))
      }
      columnWidths[resizingCol] = newWidth
    }
  }

  function handleResizeMouseMove(event: MouseEvent) {
    if (resizingCol === null) return
    applyResizeDiff(event.clientX - resizeStartX)
  }

  function handleResizeKeydown(event: KeyboardEvent, ci: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const widths = captureAllWidths()
    columnWidths = widths
    resizingCol = ci
    resizeStartWidth = widths[ci]
    resizeSiblingTotal =
      ci < model.columnCount - 1 ? widths[ci] + widths[ci + 1] : null
    userResized = true
    applyResizeDiff(event.key === 'ArrowRight' ? 10 : -10)
    resizingCol = null
  }

  function handleResizeMouseUp() {
    resizingCol = null
  }

  // Recalculate %-based widths when container resizes, unless the user has
  // manually overridden column widths via drag.
  $effect(() => {
    const container = gridContainer
    if (!container || !initialColumnWidths?.length) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (userResized) return
      columnWidths = resolveInitialWidths()
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  // --- Column width style helpers ---

  // True when any column has an explicit pixel width, switching the table to
  // fixed layout so each sized column keeps its exact width.
  const managedWidths = $derived(columnWidths.length > 0)

  // Total table width: row-number column plus all data columns.
  const totalWidth = $derived.by(() => {
    let sum = ROW_NUMBER_WIDTH
    for (let i = 0; i < model.columnCount; i++) {
      sum += columnWidths[i]
    }
    return sum
  })

  // Keep columnWidths aligned with the current column count whenever the grid
  // structure changes in managed mode (e.g. columns inserted/removed).
  $effect(() => {
    const count = model.columnCount
    if (columnWidths.length === count) return
    if (count === 0) return
    if (columnWidths.length === 0 && initialColumnWidths?.length) {
      columnWidths = resolveInitialWidths()
      return
    }
    if (columnWidths.length === 0) return
    const next: number[] = []
    for (let i = 0; i < count; i++) {
      next.push(columnWidths[i] ?? getColumnCellWidth(i) ?? 128)
    }
    columnWidths = next
  })

  function columnWidthStyle(ci: number): string {
    const w = columnWidths[ci]
    if (w == null) return ''
    return `width:${w}px;min-width:${w}px;`
  }

  function cellStyles(ci: number, highlightStyle: string): string {
    const ws = columnWidthStyle(ci)
    if (!ws && !highlightStyle) return ''
    const parts: string[] = []
    if (ws) parts.push(ws)
    if (highlightStyle) parts.push(highlightStyle)
    return parts.join(';')
  }

  function handleWindowMouseUp() {
    sel.endDrag()
    autoScroll.stop()
    handleResizeMouseUp()
  }

  function handleInputFocus(ri: number, ci: number) {
    const cell = model.rows[ri]?.cells[ci]
    editSnapshot = { ri, ci, value: cell?.value ?? '', committed: cell?.committed ?? true }
    sel.setActiveCell(ri, ci)
  }

  function handleInputKeydown(event: KeyboardEvent, ri: number, ci: number) {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      if (ci < model.columnCount - 1) {
        focus.cellInput(ri, ci + 1)
        return
      } else if (ri < model.rowCount - 1) {
        focus.cellInput(ri + 1, 0)
        return
      }
    } else if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault()
      if (ci > 0) {
        focus.cellInput(ri, ci - 1)
        return
      } else if (ri > 0) {
        focus.cellInput(ri - 1, model.columnCount - 1)
        return
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const nextRi = Math.min(model.rowCount - 1, ri + 1)
      sel.setActiveCell(nextRi, ci)
      ;(event.target as HTMLInputElement).blur()
      tick().then(() => focus.cellBox(nextRi, ci))
    } else if (event.key === 'Escape') {
      event.preventDefault()
      const cell = model.rows[ri]?.cells[ci]
      if (cell && editSnapshot.ri === ri && editSnapshot.ci === ci) {
        cell.value = editSnapshot.value
        cell.committed = editSnapshot.committed
      }
      ;(event.target as HTMLInputElement).blur()
      model.pruneTrailingPendingRows(ri - 1)
      model.pruneTrailingPendingColumns(ci - 1)
      const target = model.rows[ri] ? ri : ri - 1
      if (model.rows[target]) {
        tick().then(() => focus.cellBox(target, ci))
      }
    }
  }

  function handleBoxPaste(event: ClipboardEvent, ri: number, ci: number) {
    if (event.target !== event.currentTarget) return
    const text = event.clipboardData?.getData('text') ?? ''
    if (!text) return
    event.preventDefault()
    const cell = model.rows[ri]?.cells[ci]
    if (!cell) return
    model.setValue(ri, ci, text)
    sel.setActiveCell(ri, ci)
    focus.cellInput(ri, ci)
  }

  function handleBodyBlur() {
    model.flushCommit()
  }

  function handleTrim() {
    sel.trimSelected()
  }

  // --- Sorting ---
  //
  // The column label row (topmost header row) sorts the data rows by the
  // clicked column. Clicking the same column again toggles asc/desc; clicking
  // a different column restarts at ascending. When a cell in the sort column is
  // edited afterwards, the order is invalidated and the active sort indicator
  // is hidden so the user can resort.

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
</script>

<svelte:window onmouseup={handleWindowMouseUp} onmousemove={event => { autoScroll.onWindowMouseMove(event); handleResizeMouseMove(event) }} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div data-testid={testId} onkeydown={handleHistoryKeydown} class="flex h-full flex-col gap-2 bg-slate-950 p-2 text-slate-200">
  <div class="flex flex-none flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-1">
      {#if !hideHeaderToggle}
        <Button size="sm" ariaLabel="Toggle header" tooltip="Toggle header" onClick={() => (showHeaders = !showHeaders)}>
          {#snippet icon()}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="1" />
              <path d="M3 8h14" />
              <path d="M8 8v9" />
            </svg>
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel="Insert row above"
        tooltip="Insert row above"
        onClick={() => sel.insertRowAt(sel.actionRow, false)}
        disabled={sel.rowInsertDisabled}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 7h14" />
            <path d="M10 3v4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Insert row below"
        tooltip="Insert row below"
        onClick={() => (sel.noSelection ? sel.addRow() : sel.insertRowAt(sel.actionRow, true))}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 13h14" />
            <path d="M10 13v4" />
          </svg>
        {/snippet}
      </Button>
      {#if maxColumns == null}
        <Button
          size="sm"
          ariaLabel="Insert column before"
          tooltip="Insert column before"
          onClick={() => sel.insertColumnAt(sel.actionCol, true)}
          disabled={selState.selectedCols.size === 0}>
          {#snippet icon()}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="1" />
              <path d="M7 3v14" />
              <path d="M3 10h4" />
            </svg>
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Insert column after"
          tooltip="Insert column after"
          onClick={() => (sel.noSelection ? sel.addColumn() : sel.insertColumnAt(sel.actionCol + 1, true))}>
          {#snippet icon()}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="1" />
              <path d="M13 3v14" />
              <path d="M13 10h4" />
            </svg>
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel="Delete rows"
        tooltip="Delete rows"
        onClick={() => sel.deleteSelectedRows()}
        disabled={selState.selectedRows.size === 0}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M4 6h12" />
            <path d="M8 6V4h4v2" />
            <path d="M6 6l.7 10h6.6L14 6" />
            <path d="M9 9v4M11 9v4" />
          </svg>
        {/snippet}
      </Button>
      {#if maxColumns == null}
        <Button
          size="sm"
          ariaLabel="Delete columns"
          tooltip="Delete columns"
          onClick={() => sel.deleteSelectedColumns()}
          disabled={selState.selectedCols.size === 0}>
          {#snippet icon()}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M5 3h2l1-1l2-1h2l2 1 1 1h2" />
              <path d="M6 5l1 12h6l1-12" />
              <path d="M9 8v6M11 8v6" />
            </svg>
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel="Remove empty trailing rows/columns"
        tooltip="Remove empty trailing rows/columns"
        onClick={handleTrim}
        disabled={!model.needsTrim}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 8h14M8 3v14" />
            <path d="M9 10h4" />
            <path d="M12 8l2 2-2 2" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Undo"
        tooltip="Undo (Ctrl+Z)"
        onClick={() => {
          model.undo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={!historyState.canUndo}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Redo"
        tooltip="Redo (Ctrl+Shift+Z)"
        onClick={() => {
          model.redo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={!historyState.canRedo}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        {/snippet}
      </Button>
    </div>
    <span class="text-xs text-slate-500">{model.rowCount} rows · {model.columnCount} columns</span>
  </div>

  <div class="min-h-0 flex-1 overflow-auto rounded-md" bind:this={gridContainer}>
    <table
      role="grid"
      aria-label="Spreadsheet"
      aria-rowcount={(showHeaders ? 2 : 1) + (showHeaders ? model.rowCount - 1 : model.rowCount)}
      aria-colcount={model.columnCount}
      class="border-separate border-spacing-0 border-t border-l border-slate-800 text-sm {managedWidths ? '' : 'w-full'}"
      style={managedWidths ? `table-layout:fixed;width:${totalWidth}px;` : ''}>
      {#if managedWidths}
        <colgroup>
          <col style="width:2.25rem;">
          {#each Array.from({ length: model.columnCount }) as _, ci}
            <col style="width:{columnWidths[ci]}px;">
          {/each}
        </colgroup>
      {/if}
      {#if model.rowCount > 0}
        <thead>
          <tr aria-rowindex="1" class="sticky top-0 z-20 bg-slate-900">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <th
              role="columnheader"
              aria-label="Select all"
              class="sticky left-0 top-0 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
              style="min-width:2.25rem;max-width:2.25rem;"
              data-select-all
              tabindex="-1"
              onmousedown={sel.handleSelectAllMousedown}
              onkeydown={sel.handleSelectAllKeydown}></th>
            {#each Array.from({ length: model.columnCount }) as _, ci}
              {@const isSortActive = sortColumn === ci}
              {@const isSortAsc = isSortActive && sortDirection === 'asc'}
              {@const isSortDesc = isSortActive && sortDirection === 'desc'}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <th
                role="columnheader"
                aria-colindex={ci + 1}
                aria-sort={isSortActive ? (isSortAsc ? 'ascending' : 'descending') : undefined}
                class="{sel.columnSelectorClass(ci, ci === model.columnCount - 1)} group"
                style="position:relative;{columnWidthStyle(ci)}"
                data-col-selector={ci}
                tabindex="-1"
                onmousedown={event => sel.handleColumnSelectorMousedown(event, ci)}
                onmouseenter={() => sel.handleColumnSelectorMouseOver(ci)}
                onkeydown={event => sel.handleColumnSelectorKeydown(event, ci)}>
                <span class="flex w-full items-center justify-center gap-1.5 text-center">
                  <span>{columnLabels?.[ci] ?? columnLetter(ci)}</span>
                  <span
                    class="flex flex-col text-slate-400 transition-opacity {isSortActive ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100">
                    <button
                      type="button"
                      class="leading-none transition-colors {isSortAsc ? 'text-cyan-400' : 'hover:text-cyan-300'}"
                      aria-label={`Sort ${columnLabels?.[ci] ?? columnLetter(ci)} ascending`}
                      onmousedown={event => event.stopPropagation()}
                      onclick={() => handleSortClick(ci, 'asc')}>
                      <svg viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                        <path d="M10 4l6 8H4l6-8Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="-mt-1 leading-none transition-colors {isSortDesc ? 'text-cyan-400' : 'hover:text-cyan-300'}"
                      aria-label={`Sort ${columnLabels?.[ci] ?? columnLetter(ci)} descending`}
                      onmousedown={event => event.stopPropagation()}
                      onclick={() => handleSortClick(ci, 'desc')}>
                      <svg viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                        <path d="M10 16 4 8h12l-6 8Z" />
                      </svg>
                    </button>
                  </span>
                </span>
                <button
                  type="button"
                  class="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize border-0 bg-transparent p-0 hover:bg-cyan-500/40"
                  style={ci < model.columnCount - 1 ? 'right:-3px;' : 'right:0;'}
                  aria-label="Resize column {ci + 1}"
                  onmousedown={event => startColumnResize(event, ci)}
                  onkeydown={event => handleResizeKeydown(event, ci)}
                ></button>
              </th>
            {/each}
          </tr>
          {#if showHeaders && model.rowCount > 0}
            <tr aria-rowindex="2" class="sticky top-6 z-20 bg-slate-900">
              <th
                role="columnheader"
                class="sticky left-0 top-6 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
                style="min-width:2.25rem;max-width:2.25rem;"
              ></th>
              {#each model.rows[0].cells as cell, ci (cell.id)}
                <th
                  role="columnheader"
                  aria-colindex={ci + 1}
                  aria-selected={sel.isCellSelected(0, ci)}
                  class={sel.cellClass(
                    'min-w-32 border-b border-r border-b-slate-600 border-r-slate-800 p-0 font-semibold outline-none',
                    0,
                    ci,
                  )}
                  style={cellStyles(ci, sel.rangeHighlightStyle(0, ci))}
                  tabindex="-1"
                  onmousedown={event => sel.handleCellMousedown(event, 0, ci)}
                  ondblclick={event => sel.handleCellDoubleClick(event, 0, ci)}
                  onmouseenter={() => sel.handleCellMouseOver(0, ci)}
                  onkeydown={event => sel.handleBoxKeydown(event, 0, ci)}
                  onpaste={event => handleBoxPaste(event, 0, ci)}>
                  <input
                    data-row={0}
                    data-col={ci}
                    class="w-full border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-inset focus:ring-cyan-500/70"
                    value={cell.value}
                    oninput={event => model.setValue(0, ci, event.currentTarget.value)}
                    onfocus={() => {
                      handleInputFocus(0, ci)
                      focus.cellInputAtEnd(0, ci)
                    }}
                    onblur={() => handleBodyBlur()}
                    onkeydown={event => handleInputKeydown(event, 0, ci)} />
                </th>
              {/each}
            </tr>
          {/if}
        </thead>
        <tbody>
          {#each showHeaders ? model.rows.slice(1) : model.rows as row, ri (row.id)}
            {@const actualRi = showHeaders ? ri + 1 : ri}
            <tr aria-rowindex={showHeaders ? ri + 3 : ri + 2} class={sel.trClass(actualRi)}>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <td
                role="rowheader"
                aria-rowindex={showHeaders ? ri + 3 : ri + 2}
                aria-selected={sel.selectedRows.has(actualRi)}
                class={sel.rowSelectorClass(actualRi)}
                data-row-selector={actualRi}
                tabindex="-1"
                onmousedown={event => sel.handleRowSelectorMousedown(event, actualRi)}
                onmouseenter={() => sel.handleRowSelectorMouseOver(actualRi)}
                onkeydown={event => sel.handleRowSelectorKeydown(event, actualRi)}>
                <span class="px-1.5 text-xs text-slate-500">{ri + 1}</span>
              </td>
              {#each row.cells as cell, ci (cell.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <td
                  role="gridcell"
                  aria-colindex={ci + 1}
                  aria-selected={sel.isCellSelected(actualRi, ci)}
                  class={sel.cellClass(
                    'min-w-32 border-b border-r border-slate-800 p-0 outline-none',
                    actualRi,
                    ci,
                  )}
                  style={cellStyles(ci, sel.rangeHighlightStyle(actualRi, ci))}
                  tabindex="-1"
                  onmousedown={event => sel.handleCellMousedown(event, actualRi, ci)}
                  ondblclick={event => sel.handleCellDoubleClick(event, actualRi, ci)}
                  onmouseenter={() => sel.handleCellMouseOver(actualRi, ci)}
                  onkeydown={event => sel.handleBoxKeydown(event, actualRi, ci)}
                  onpaste={event => handleBoxPaste(event, actualRi, ci)}>
                  <input
                    data-row={actualRi}
                    data-col={ci}
                    class="w-full border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-inset focus:ring-cyan-500/70"
                    value={cell.value}
                    oninput={event => model.setValue(actualRi, ci, event.currentTarget.value)}
                    onfocus={() => handleInputFocus(actualRi, ci)}
                    onblur={() => handleBodyBlur()}
                    onkeydown={event => handleInputKeydown(event, actualRi, ci)} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      {/if}
    </table>

    {#if model.rowCount === 0}
      <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <span>No content to preview</span>
        <button class="rounded border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800" onclick={() => sel.addRow()}>
          Add row
        </button>
      </div>
    {/if}
  </div>
</div>
