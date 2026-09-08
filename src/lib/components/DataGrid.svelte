<script lang="ts">
  import { tick } from 'svelte'
  import Button from './Button.svelte'
  import { createGridModel } from './use-grid-model.svelte'
  import { createGridSelection, createInitialSelectionState, RANGE_COLOR } from './use-grid-selection.svelte'
  import { createGridClipboard } from './use-grid-clipboard'
  import { createAutoScroll } from './use-grid-autoscroll.svelte'
  import { columnLetter } from './grid-utils'
  import { createColumnResize } from './use-column-resize.svelte'
  import TableIcon from '$lib/icons/TableIcon.svelte'
  import RowInsertAboveIcon from '$lib/icons/RowInsertAboveIcon.svelte'
  import RowInsertBelowIcon from '$lib/icons/RowInsertBelowIcon.svelte'
  import ColumnInsertBeforeIcon from '$lib/icons/ColumnInsertBeforeIcon.svelte'
  import ColumnInsertAfterIcon from '$lib/icons/ColumnInsertAfterIcon.svelte'
  import DeleteRowsIcon from '$lib/icons/DeleteRowsIcon.svelte'
  import DeleteColumnsIcon from '$lib/icons/DeleteColumnsIcon.svelte'
  import TrimIcon from '$lib/icons/TrimIcon.svelte'
  import UndoIcon from '$lib/icons/UndoIcon.svelte'
  import RedoIcon from '$lib/icons/RedoIcon.svelte'
  import SortAscIcon from '$lib/icons/SortAscIcon.svelte'
  import SortDescIcon from '$lib/icons/SortDescIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    value?: string[][]
    onChange?: (rows: string[][]) => void
    editable?: boolean
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
    // When set, resized column widths are persisted to localStorage under this
    // key and restored on mount (overriding initialColumnWidths).
    storageKey?: string
  }

  let {
    value = [],
    onChange,
    editable = true,
    showHeaders = $bindable(true),
    testId = 'data-grid',
    maxColumns,
    columnLabels,
    hideHeaderToggle = false,
    initialColumnWidths,
    storageKey,
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
  // Width given to a freshly inserted column in managed mode, matching the
  // auto-width `min-w-32` floor.
  const DEFAULT_COLUMN_WIDTH = 128
  // The tallest an editing multiline cell may grow; beyond this the editor
  // scrolls vertically.
  const EDITOR_MAX_LINES = 5
  // While a multiline cell is being edited, its editor floats as an overlay
  // anchored to the cell, so the row never grows and the rest of the grid
  // keeps its layout. Height is driven by the `rows` attribute, so every line
  // matches a single-line cell's line height. The overlay spans the cell's
  // border box (`left/right:-1px` against the padding box reach the border-box
  // left/right edges) and carries the cell's own right/bottom border plus a
  // left border in the selection outline color (the editing cell is always
  // selected), so the expanded lines stay wrapped in the same blue border as
  // the cell on every side — the base row's top/left grid lines come from the
  // neighboring cells, but the expanded area below the base row would otherwise
  // fall outside them.
  const EDITOR_OVERLAY_STYLE =
    `position:absolute;top:0;left:-1px;right:-1px;width:auto;border-left:1px solid ${RANGE_COLOR};border-right:1px solid ${RANGE_COLOR};border-bottom:1px solid ${RANGE_COLOR};`
  // Appended to EDITOR_OVERLAY_STYLE when the editing value exceeds
  // EDITOR_MAX_LINES, so the overlay scrolls instead of growing further.
  const EDITOR_OVERLAY_SCROLL_STYLE = 'overflow-y:auto;'

  // Column widths in pixels. Empty array means auto-width (min-w-32 fallback).
  let columnWidths = $state<number[]>([])
  let autoColumnWidths = $state<number[]>([])

  let gridContainer: HTMLElement | null = null
  let headerWrapper: HTMLElement | null = null
  let rootEl: HTMLElement | null = null

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

  function equalWidths(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }

  function resolveAutoWidths(): number[] {
    const count = model.columnCount
    if (count === 0) return []
    const available = Math.max(
      MIN_COLUMN_WIDTH * count,
      (gridContainer?.clientWidth ?? rootEl?.clientWidth ?? 0) - ROW_NUMBER_WIDTH - TABLE_LEFT_BORDER,
    )
    const base = Math.max(MIN_COLUMN_WIDTH, Math.floor(available / count))
    const widths = Array.from({ length: count }, () => base)
    widths[count - 1] = Math.max(MIN_COLUMN_WIDTH, available - base * (count - 1))
    return widths
  }

  $effect(() => {
    if (!gridContainer) return
    const persisted = resize.loadPersistedWidths()
    if (persisted != null) {
      columnWidths = persisted
    } else if (columnWidths.length === 0 && initialColumnWidths?.length) {
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

  let editSnapshot: { ri: number; ci: number; value: string; committed: boolean } = {
    ri: -1,
    ci: -1,
    value: '',
    committed: true,
  }

  // The cell whose editor currently has focus. Multiline cells grow to double
  // height only while being edited; on commit/blur they return to single-line.
  let editingCell = $state<{ ri: number; ci: number } | null>(null)
  function isCellEditing(ri: number, ci: number): boolean {
    return editingCell?.ri === ri && editingCell?.ci === ci
  }

  function gridEl<T extends Element>(selector: string): T | null {
    return rootEl?.querySelector<T>(selector) ?? null
  }

  function cellInputEl(ri: number, ci: number): HTMLTextAreaElement | null {
    return gridEl<HTMLTextAreaElement>(`[data-row="${ri}"][data-col="${ci}"]`)
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
    rowSelector(ri: number) { gridEl<HTMLElement>(`[data-row-selector="${ri}"]`)?.focus() },
    columnSelector(ci: number) { gridEl<HTMLElement>(`[data-col-selector="${ci}"]`)?.focus() },
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

  const resize = createColumnResize({
    getColumnCount: () => model.columnCount,
    getContainer: () => gridContainer,
    getColumnWidths: () => columnWidths,
    setColumnWidths: (widths: number[]) => {
      columnWidths = widths
    },
    getColumnCellWidth: (ci: number) => gridEl<HTMLElement>(`[data-col-selector="${ci}"]`)?.offsetWidth ?? 128,
    getMinWidth: () => MIN_COLUMN_WIDTH,
    getFillWidthOffset: () => TABLE_LEFT_BORDER + ROW_NUMBER_WIDTH,
    getStorageKey: () => storageKey,
  })

  // Rescale every column proportionally so the table fills the container when it
  // can, mirroring the two-table reference's container resize: the target
  // usable width is `max(minimum × count, container − rownum − border)`, so a
  // container too narrow to fit even the minimum-width columns keeps the table
  // overflowing (horizontal scroll preserved) instead of squeezing it. The last
  // column then absorbs the exact remainder so the table fills edge-to-edge.
  // Auto-width grids (no explicit widths) are left alone.
  function rescaleToContainer() {
    const available = Math.max(
      MIN_COLUMN_WIDTH * model.columnCount,
      (gridContainer?.clientWidth ?? 0) - ROW_NUMBER_WIDTH - TABLE_LEFT_BORDER,
    )
    let total = 0
    for (let i = 0; i < model.columnCount; i++) total += columnWidths[i]
    if (total <= 0) return
    const last = model.columnCount - 1
    const next: number[] = []
    for (let i = 0; i < model.columnCount; i++) {
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

  // The body wrapper's vertical scrollbar narrows its visible width; pad the
  // header wrapper by the same amount so the header table's right edge and
  // scroll range stay aligned with the body's once columns overflow. This
  // observes the body wrapper itself, so it tracks scrollbar appearance.
  $effect(() => {
    const body = gridContainer
    const header = headerWrapper
    if (!body || !header) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const scrollbarWidth = body.offsetWidth - body.clientWidth
      header.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''
    })
    observer.observe(body)
    return () => observer.disconnect()
  })

  // Re-fit columns only when the outer viewport resizes (e.g. the pane
  // splitter), never when the body wrapper's own scrollbar appears — that would
  // immediately collapse an intentionally overflowing table into a fitted one.
  $effect(() => {
    const viewport = rootEl
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

  // The header band never scrolls on its own (its wrapper clips with
  // overflow-hidden): mirror the body wrapper's horizontal scroll into it and
  // forward wheel events so scrolling still works while the pointer is over the
  // header.
  $effect(() => {
    const body = gridContainer
    const header = headerWrapper
    if (!body || !header) return
    const onScroll = () => {
      header.scrollLeft = body.scrollLeft
    }
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY !== 0) body.scrollTop += event.deltaY
      if (event.deltaX !== 0) body.scrollLeft += event.deltaX
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    header.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      body.removeEventListener('scroll', onScroll)
      header.removeEventListener('wheel', onWheel)
    }
  })

  // --- Column width style helpers ---

  // True when any column has an explicit pixel width, switching the table to
  // fixed layout so each sized column keeps its exact width.
  const managedWidths = $derived(columnWidths.length > 0)
  const renderedColumnWidths = $derived(managedWidths ? columnWidths : autoColumnWidths)

  // Total table width: row-number column plus all data columns.
  const totalWidth = $derived.by(() => {
    let sum = ROW_NUMBER_WIDTH
    for (let i = 0; i < model.columnCount; i++) {
      sum += renderedColumnWidths[i] ?? 0
    }
    return sum
  })

  // Keep columnWidths aligned with the current column count whenever the grid
  // structure changes in managed mode (e.g. columns inserted/removed). A newly
  // inserted column gets a fixed default width — never a live measurement, since
  // mid-effect its cells render at 0px (the fixed-layout table width hasn't been
  // updated yet) and would pin the column invisible. After a removal the
  // surviving columns are rescaled to refill the container, so a deleted column
  // never leaves a gap at the table's right edge.
  $effect(() => {
    const count = model.columnCount
    if (columnWidths.length === count) return
    if (count === 0) return
    if (columnWidths.length === 0 && initialColumnWidths?.length) {
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

  function columnWidthStyle(ci: number): string {
    const w = renderedColumnWidths[ci]
    if (w == null) return ''
    return `width:${w}px;min-width:${w}px;`
  }

  function mutationDisabled(disabled = false): boolean {
    return !editable || disabled
  }

  // `expanded` marks a cell whose editor is a multiline overlay: the cell is
  // positioned and raised so the absolute editor paints on top of the rows
  // below instead of growing the row.
  function cellStyles(ci: number, highlightStyle: string, expanded: boolean): string {
    const ws = columnWidthStyle(ci)
    if (!ws && !highlightStyle && !expanded) return ''
    const parts: string[] = []
    if (ws) parts.push(ws)
    if (highlightStyle) parts.push(highlightStyle)
    if (expanded) parts.push('position:relative;z-index:20;')
    return parts.join(';')
  }

  function handleWindowMouseUp() {
    sel.endDrag()
    autoScroll.stop()
    resize.handleResizeMouseUp()
  }

  function handleInputFocus(ri: number, ci: number) {
    const cell = model.rows[ri]?.cells[ci]
    editSnapshot = { ri, ci, value: cell?.value ?? '', committed: cell?.committed ?? true }
    sel.setActiveCell(ri, ci)
    editingCell = { ri, ci }
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
    editingCell = null
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

<svelte:window onmouseup={handleWindowMouseUp} onmousemove={event => { autoScroll.onWindowMouseMove(event); resize.handleResizeMouseMove(event) }} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div data-testid={testId} onkeydown={handleHistoryKeydown} class="flex h-full flex-col gap-2 bg-slate-950 p-2 text-slate-200">
  <div class="flex flex-none flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-1">
      {#if !hideHeaderToggle}
        <Button size="sm" ariaLabel={i18n.t('grid.toggleHeader')} tooltip={i18n.t('grid.toggleHeader')} ariaPressed={showHeaders} onClick={() => (showHeaders = !showHeaders)} disabled={!editable}>
          {#snippet icon()}
            <TableIcon />
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.insertRowAbove')}
        tooltip={i18n.t('grid.insertRowAbove')}
        onClick={() => sel.insertRowAt(sel.actionRow, false)}
        disabled={mutationDisabled(sel.rowInsertDisabled)}>
        {#snippet icon()}
          <RowInsertAboveIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.insertRowBelow')}
        tooltip={i18n.t('grid.insertRowBelow')}
        onClick={() => (sel.noSelection ? sel.addRow() : sel.insertRowAt(sel.actionRow, true))}
        disabled={!editable}>
        {#snippet icon()}
          <RowInsertBelowIcon />
        {/snippet}
      </Button>
      {#if maxColumns == null}
        <Button
          size="sm"
          ariaLabel={i18n.t('grid.insertColumnBefore')}
          tooltip={i18n.t('grid.insertColumnBefore')}
          onClick={() => sel.insertColumnAt(sel.actionCol, true)}
          disabled={mutationDisabled(sel.colInsertDisabled)}>
          {#snippet icon()}
            <ColumnInsertBeforeIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={i18n.t('grid.insertColumnAfter')}
          tooltip={i18n.t('grid.insertColumnAfter')}
          onClick={() => (sel.noSelection ? sel.addColumn() : sel.insertColumnAt(sel.actionCol + 1, true))}
          disabled={!editable}>
          {#snippet icon()}
            <ColumnInsertAfterIcon />
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.deleteRows')}
        tooltip={i18n.t('grid.deleteRows')}
        onClick={() => sel.deleteSelectedRows()}
        disabled={mutationDisabled(selState.selectedRows.size === 0)}>
        {#snippet icon()}
          <DeleteRowsIcon />
        {/snippet}
      </Button>
      {#if maxColumns == null}
        <Button
          size="sm"
          ariaLabel={i18n.t('grid.deleteColumns')}
          tooltip={i18n.t('grid.deleteColumns')}
          onClick={() => sel.deleteSelectedColumns()}
          disabled={mutationDisabled(selState.selectedCols.size === 0)}>
          {#snippet icon()}
            <DeleteColumnsIcon />
          {/snippet}
        </Button>
      {/if}
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.trimTrailing')}
        tooltip={i18n.t('grid.trimTrailing')}
        onClick={handleTrim}
        disabled={mutationDisabled(!model.needsTrim)}>
        {#snippet icon()}
          <TrimIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.undo')}
        tooltip={i18n.t('grid.undo')}
        onClick={() => {
          model.undo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={mutationDisabled(!historyState.canUndo)}>
        {#snippet icon()}
          <UndoIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={i18n.t('grid.redo')}
        tooltip={i18n.t('grid.redo')}
        onClick={() => {
          model.redo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={mutationDisabled(!historyState.canRedo)}>
        {#snippet icon()}
          <RedoIcon />
        {/snippet}
      </Button>
    </div>
    <span class="text-xs text-slate-400">{i18n.t('grid.rowColCount', { rows: model.rowCount, columns: model.columnCount })}</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md" bind:this={rootEl}>
    <div class="flex-none overflow-hidden" bind:this={headerWrapper}>
      <table
        role="grid"
        aria-label={i18n.t('grid.spreadsheet')}
        aria-rowcount={(showHeaders ? 2 : 1) + (showHeaders ? model.rowCount - 1 : model.rowCount)}
        aria-colcount={model.columnCount}
        class="border-separate border-spacing-0 border-t border-l border-slate-800 text-sm"
        style={renderedColumnWidths.length > 0 ? `table-layout:fixed;width:${totalWidth}px;` : 'width:100%;'}>
        {#if renderedColumnWidths.length > 0}
          <colgroup>
            <col style="width:2.25rem;">
            {#each Array.from({ length: model.columnCount }) as _, ci}
              <col style="width:{renderedColumnWidths[ci]}px;">
            {/each}
          </colgroup>
        {/if}
        {#if model.rowCount > 0}
          <thead>
            <tr aria-rowindex="1" class="sticky top-0 z-20 bg-slate-900">
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <th
                role="columnheader"
                aria-label={i18n.t('grid.selectAll')}
                class="sticky left-0 top-0 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
                style="min-width:2.25rem;max-width:2.25rem;{sel.selectAllBorderStyle()}"
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
                  class="select-none {sel.columnSelectorClass(ci, ci === model.columnCount - 1)} group"
                  style="position:relative;{columnWidthStyle(ci)}{sel.labelRowBorderStyle(ci)}"
                  data-col-selector={ci}
                  tabindex="-1"
                  onmousedown={event => sel.handleColumnSelectorMousedown(event, ci)}
                  onmouseenter={() => sel.handleColumnSelectorMouseOver(ci)}
                  onkeydown={event => sel.handleColumnSelectorKeydown(event, ci)}>
                  <span class="flex w-full items-center justify-center gap-1.5 text-center">
                    <span>{columnLabels?.[ci] ?? columnLetter(ci)}</span>
                    <span
                      class="flex flex-col text-slate-400 transition-opacity {isSortActive ? 'opacity-100' : '[@media(hover:hover)]:opacity-0'} group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        class="leading-none outline-none transition-colors {isSortAsc ? 'text-cyan-400' : 'hover:text-cyan-300 focus:text-cyan-300'}"
                        aria-label={i18n.t('grid.sortAsc', { name: columnLabels?.[ci] ?? columnLetter(ci) })}
                        onmousedown={event => event.stopPropagation()}
                        onclick={() => editable && handleSortClick(ci, 'asc')}
                        disabled={!editable}>
                        <SortAscIcon className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        class="-mt-1 leading-none outline-none transition-colors {isSortDesc ? 'text-cyan-400' : 'hover:text-cyan-300 focus:text-cyan-300'}"
                        aria-label={i18n.t('grid.sortDesc', { name: columnLabels?.[ci] ?? columnLetter(ci) })}
                        onmousedown={event => event.stopPropagation()}
                        onclick={() => editable && handleSortClick(ci, 'desc')}
                        disabled={!editable}>
                        <SortDescIcon className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  </span>
                  {#if editable}
                    <button
                      type="button"
                      class="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize border-0 bg-transparent p-0 outline-none hover:bg-cyan-500/40 focus-visible:bg-cyan-500/40"
                      style={ci < model.columnCount - 1 ? 'right:-3px;' : 'right:0;'}
                      aria-label={i18n.t('grid.resizeColumn', { index: ci + 1 })}
                      onmousedown={event => resize.startColumnResize(event, ci)}
                      onkeydown={event => resize.handleResizeKeydown(event, ci)}
                      ></button>
                  {/if}
                </th>
              {/each}
            </tr>
            {#if showHeaders && model.rowCount > 0}
              <tr aria-rowindex="2" class="sticky top-6 z-20 bg-slate-900">
                <th
                  role="columnheader"
                  class="sticky left-0 top-6 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
                  style="min-width:2.25rem;max-width:2.25rem;{sel.rowNumberBorderStyle(0)}"
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
                    style={cellStyles(ci, sel.rangeHighlightStyle(0, ci), false)}
                    tabindex="-1"
                    onmousedown={event => sel.handleCellMousedown(event, 0, ci)}
                    ondblclick={event => sel.handleCellDoubleClick(event, 0, ci)}
                    onmouseenter={() => sel.handleCellMouseOver(0, ci)}
                    onkeydown={event => sel.handleBoxKeydown(event, 0, ci)}
                    onpaste={event => handleBoxPaste(event, 0, ci)}>
                    <textarea
                      data-row={0}
                      data-col={ci}
                      rows={isCellEditing(0, ci) && cell.value.includes('\n') ? 2 : 1}
                      wrap="off"
                      class="w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800"
                      value={cell.value}
                      readonly={!editable}
                      oninput={event => editable && model.setValue(0, ci, event.currentTarget.value)}
                      onfocus={() => {
                        handleInputFocus(0, ci)
                        focus.cellInputAtEnd(0, ci)
                      }}
                      onblur={() => handleBodyBlur()}
                      onkeydown={event => editable && handleInputKeydown(event, 0, ci)}></textarea>
                  </th>
                {/each}
              </tr>
            {/if}
          </thead>
        {/if}
        </table>
      </div>
      <div class="min-h-0 flex-1 overflow-auto" bind:this={gridContainer}>
        <table
          role="grid"
          aria-label={i18n.t('grid.spreadsheet')}
          aria-rowcount={(showHeaders ? 2 : 1) + (showHeaders ? model.rowCount - 1 : model.rowCount)}
          aria-colcount={model.columnCount}
class="border-separate border-spacing-0 border-l border-slate-800 text-sm"
        style={renderedColumnWidths.length > 0 ? `table-layout:fixed;width:${totalWidth}px;` : 'width:100%;'}>
          {#if renderedColumnWidths.length > 0}
            <colgroup>
              <col style="width:2.25rem;">
              {#each Array.from({ length: model.columnCount }) as _, ci}
                <col style="width:{renderedColumnWidths[ci]}px;">
              {/each}
            </colgroup>
          {/if}
          {#if model.rowCount > 0}
            <tbody>
              {#each showHeaders ? model.rows.slice(1) : model.rows as row, ri (row.id)}
                {@const actualRi = showHeaders ? ri + 1 : ri}
                <tr aria-rowindex={showHeaders ? ri + 3 : ri + 2} class={sel.trClass(actualRi)}>
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <td
                    role="rowheader"
                    aria-rowindex={showHeaders ? ri + 3 : ri + 2}
                    aria-selected={sel.selectedRows.has(actualRi)}
                    class="select-none {sel.rowSelectorClass(actualRi)}"
                    style={sel.rowNumberBorderStyle(actualRi)}
                    data-row-selector={actualRi}
                    tabindex="-1"
                    onmousedown={event => sel.handleRowSelectorMousedown(event, actualRi)}
                    onmouseenter={() => sel.handleRowSelectorMouseOver(actualRi)}
                    onkeydown={event => sel.handleRowSelectorKeydown(event, actualRi)}>
                    <span class="px-1.5 text-xs text-slate-500">{ri + 1}</span>
                  </td>
                  {#each row.cells as cell, ci (cell.id)}
                    {@const lineCount = cell.value.split('\n').length}
                    {@const expanded = isCellEditing(actualRi, ci) && lineCount > 1}
                    {@const editorLines = Math.min(lineCount, EDITOR_MAX_LINES)}
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
                      style={cellStyles(ci, sel.rangeHighlightStyle(actualRi, ci), expanded)}
                      tabindex="-1"
                      onmousedown={event => sel.handleCellMousedown(event, actualRi, ci)}
                      ondblclick={event => sel.handleCellDoubleClick(event, actualRi, ci)}
                      onmouseenter={() => sel.handleCellMouseOver(actualRi, ci)}
                      onkeydown={event => sel.handleBoxKeydown(event, actualRi, ci)}
                      onpaste={event => handleBoxPaste(event, actualRi, ci)}>
                      <textarea
                        data-row={actualRi}
                        data-col={ci}
                        rows={expanded ? editorLines : 1}
                        wrap="off"
                        class="w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800"
                        style={expanded
                          ? EDITOR_OVERLAY_STYLE + (lineCount > EDITOR_MAX_LINES ? EDITOR_OVERLAY_SCROLL_STYLE : '')
                          : ''}
                        value={cell.value}
                        readonly={!editable}
                        oninput={event => editable && model.setValue(actualRi, ci, event.currentTarget.value)}
                        onfocus={() => handleInputFocus(actualRi, ci)}
                        onblur={() => handleBodyBlur()}
                        onkeydown={event => editable && handleInputKeydown(event, actualRi, ci)}></textarea>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          {/if}
        </table>

        {#if model.rowCount === 0}
          <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <span>No content to preview</span>
            <button class="rounded border border-slate-700 px-3 py-1 text-slate-300 outline-none transition hover:bg-slate-800 focus:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" onclick={() => sel.addRow()} disabled={!editable}>
              Add row
            </button>
          </div>
        {/if}
      </div>
  </div>
</div>
