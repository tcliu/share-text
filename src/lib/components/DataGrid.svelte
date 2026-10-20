<script lang="ts">
  import { tick, untrack } from 'svelte'
  import Button from './Button.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { createGridModel } from './use-grid-model.svelte'
  import { createGridSelection, createInitialSelectionState } from './use-grid-selection.svelte'
  import {
    RANGE_COLOR,
    gridCellClass,
    gridRowClass,
    rangeHighlightStyle,
    rowSelectorClass,
    columnSelectorClass,
    labelRowBorderStyle,
    selectAllBorderStyle,
    rowNumberBorderStyle,
  } from './grid-styles'
  import { createGridClipboard } from './use-grid-clipboard'
  import { createAutoScroll } from './use-grid-autoscroll.svelte'
  import { columnLetter } from './grid-utils'
  import { createGridColumns } from './use-grid-columns.svelte'
  import { createTableScrollSync } from './use-table-scroll-sync.svelte'
  import { createGridCellRefs } from './grid-cell-refs'
  import { createGridEditor } from './use-grid-editor.svelte'
  import { createGridSort } from './use-grid-sort.svelte'
  import { createGridUndoRedo } from './use-grid-undo-redo.svelte'
  import GridToolbar from './GridToolbar.svelte'
  import CaretDownIcon from '$lib/icons/CaretDownIcon.svelte'
  import CaretUpIcon from '$lib/icons/CaretUpIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    value?: string[][]
    onChange?: (rows: string[][]) => void
    editable?: boolean
    showHeaders?: boolean
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
    size?: SizeInput
  }

  let {
    value = [],
    onChange,
    editable = true,
    showHeaders = $bindable(true),
    maxColumns,
    columnLabels,
    hideHeaderToggle = false,
    initialColumnWidths,
    storageKey,
    size = 'md',
  }: Props = $props()

  const model = createGridModel({
    getValue: () => value,
    getHeaders: () => showHeaders,
    onChange: m => onChange?.(m),
    // Column cap is fixed config captured at grid creation; the untracked read
    // makes that one-time capture explicit instead of a suppressed warning.
    maxColumns: untrack(() => maxColumns),
  })

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
  const EDITOR_OVERLAY_STYLE = `position:absolute;top:0;left:-1px;right:-1px;width:auto;border-left:1px solid ${RANGE_COLOR};border-right:1px solid ${RANGE_COLOR};border-bottom:1px solid ${RANGE_COLOR};`
  // Appended to EDITOR_OVERLAY_STYLE when the editing value exceeds
  // EDITOR_MAX_LINES, so the overlay scrolls instead of growing further.
  const EDITOR_OVERLAY_SCROLL_STYLE = 'overflow-y:auto;'

  let gridContainer: HTMLElement | null = null
  let headerWrapper: HTMLElement | null = null
  let rootEl: HTMLElement | null = null

  // Owned-node registry: cells, editors, and selectors register their own nodes
  // through actions, so focus never queries the DOM (see grid-cell-refs.ts).
  const cellRefs = createGridCellRefs()

  const focus = {
    cellBox(ri: number, ci: number) {
      cellRefs.cellBox(ri, ci)?.focus()
    },
    cellInput(ri: number, ci: number) {
      cellRefs.cellInput(ri, ci)?.focus()
    },
    cellInputAtEnd(ri: number, ci: number) {
      tick().then(() => {
        const input = cellRefs.cellInput(ri, ci)
        if (input) {
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
      })
    },
    cellInputSelectAll(ri: number, ci: number) {
      tick().then(() => {
        const input = cellRefs.cellInput(ri, ci)
        if (input) {
          input.focus()
          input.setSelectionRange(0, input.value.length)
        }
      })
    },
    startEdit(ri: number, ci: number, value: string) {
      model.setValue(ri, ci, value)
      cellRefs.cellInput(ri, ci)?.focus()
    },
    rowSelector(ri: number) {
      cellRefs.rowSelector(ri)?.focus()
    },
    columnSelector(ci: number) {
      cellRefs.colSelector(ci)?.focus()
    },
    isCellInputFocused(ri: number, ci: number) {
      return editor.isCellEditing(ri, ci)
    },
  }

  const clipboard = createGridClipboard()
  const selState = $state(createInitialSelectionState())
  const sel = createGridSelection({ model, focus, clipboard, state: selState, isEditable: () => editable })

  const editor = createGridEditor({ model, focus, sel, isEditable: () => editable })
  const undoRedo = createGridUndoRedo({ model, focus, sel, isEditable: () => editable })
  const sort = createGridSort(model)

  const autoScroll = createAutoScroll({
    getContainer: () => gridContainer,
    isDragging: sel.isDragging,
    onCellHover: (ri, ci) => sel.handleCellMouseOver(ri, ci),
    onRowHover: ri => sel.handleRowSelectorMouseOver(ri),
    onColHover: ci => sel.handleColumnSelectorMouseOver(ci),
  })

  $effect(() => () => autoScroll.stop())

  // --- Column widths and resize ---
  //
  // The width engine (initial/auto widths, container rescale, and the resize
  // handles) lives in `use-grid-columns`; the grid keeps only presentation. Each
  // data column is bounded by two splitters: dragging the splitter between
  // columns ci and ci+1 re-partitions those two adjacent columns, and the
  // splitter after the last column moves the table's right edge.
  const columns = createGridColumns({
    getColumnCount: () => model.columnCount,
    getContainer: () => gridContainer,
    getViewport: () => rootEl,
    getColumnCellWidth: (ci: number) => cellRefs.colSelector(ci)?.offsetWidth ?? 128,
    getInitialColumnWidths: () => initialColumnWidths,
    getStorageKey: () => storageKey,
  })

  createTableScrollSync({
    getBody: () => gridContainer,
    getHeader: () => headerWrapper,
    padHeaderForScrollbar: true,
  })

  // `expanded` marks a cell whose editor is a multiline overlay: the cell is
  // positioned and raised so the absolute editor paints on top of the rows
  // below instead of growing the row.
  function cellStyles(ci: number, highlightStyle: string, expanded: boolean): string {
    const ws = columns.columnWidthStyle(ci)
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
    columns.resize.handleResizeMouseUp()
  }

  function handleTrim() {
    sel.trimSelected()
  }
</script>

<svelte:window
  onmouseup={handleWindowMouseUp}
  onmousemove={event => {
    autoScroll.onWindowMouseMove(event)
    columns.resize.handleResizeMouseMove(event)
  }} />

<!-- False positive: the root is a shortcut host, not an interactive element.
     Ctrl+Z/Y arrive as keydown events bubbled from the focusable grid cells it
     wraps; the container itself has no role and needs none. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-testid="data-grid"
  onkeydown={undoRedo.handleHistoryKeydown}
  class="flex h-full flex-col gap-2 bg-slate-950 p-2 text-slate-200">
  <GridToolbar
    {size}
    {model}
    {sel}
    {showHeaders}
    onToggleHeaders={() => (showHeaders = !showHeaders)}
    {editable}
    {hideHeaderToggle}
    {maxColumns}
    historyState={undoRedo.historyState}
    onTrim={handleTrim}
    onUndo={undoRedo.undo}
    onRedo={undoRedo.redo} />

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md" bind:this={rootEl}>
    <div class="flex-none overflow-hidden" bind:this={headerWrapper}>
      <table
        role="grid"
        aria-label={i18n.t('grid.spreadsheet')}
        aria-rowcount={model.rowCount + 1}
        aria-colcount={model.columnCount}
        class="border-separate border-spacing-0 border-t border-l border-slate-800 text-sm"
        style={columns.renderedColumnWidths.length > 0
          ? `table-layout:fixed;width:${columns.totalWidth}px;`
          : 'width:100%;'}>
        {#if columns.renderedColumnWidths.length > 0}
          <colgroup>
            <col style="width:2.25rem;" />
            {#each Array.from({ length: model.columnCount }) as _, ci}
              <col style="width:{columns.renderedColumnWidths[ci]}px;" />
            {/each}
          </colgroup>
        {/if}
        {#if model.rowCount > 0}
          <thead>
            <tr aria-rowindex="1" class="sticky top-0 z-20 bg-slate-900">
              <th
                role="columnheader"
                aria-label={i18n.t('grid.selectAll')}
                class="sticky top-0 left-0 z-30 w-9 border-r border-b border-r-slate-500 border-b-slate-600 bg-slate-900 p-0 text-center font-normal"
                style="min-width:2.25rem;max-width:2.25rem;{selectAllBorderStyle(sel.isCellSelected(0, 0))}"
                data-select-all
                tabindex="-1"
                onmousedown={sel.handleSelectAllMousedown}
                onkeydown={sel.handleSelectAllKeydown}></th>
              {#each Array.from({ length: model.columnCount }) as _, ci}
                {@const isSortActive = sort.sortColumn === ci}
                {@const isSortAsc = isSortActive && sort.sortDirection === 'asc'}
                {@const isSortDesc = isSortActive && sort.sortDirection === 'desc'}
                <th
                  use:cellRefs.colSelectorRef={{ ci }}
                  role="columnheader"
                  aria-colindex={ci + 1}
                  aria-sort={isSortActive ? (isSortAsc ? 'ascending' : 'descending') : undefined}
                  class="select-none {columnSelectorClass(
                    sel.isColumnSelected(ci),
                    ci === model.columnCount - 1,
                  )} group"
                  style="position:relative;{columns.columnWidthStyle(ci)}{labelRowBorderStyle(
                    sel.isCellSelected(0, ci),
                  )}"
                  data-col-selector={ci}
                  tabindex="-1"
                  onmousedown={event => sel.handleColumnSelectorMousedown(event, ci)}
                  onmouseenter={() => sel.handleColumnSelectorMouseOver(ci)}
                  onkeydown={event => sel.handleColumnSelectorKeydown(event, ci)}>
                  <span class="flex w-full items-center justify-center gap-1.5 text-center">
                    <span>{columnLabels?.[ci] ?? columnLetter(ci)}</span>
                    <span
                      class="flex flex-col gap-0.5 text-slate-400 transition-opacity {isSortActive
                        ? 'opacity-100'
                        : '[@media(hover:hover)]:opacity-0'} group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        class="flex leading-none transition-colors outline-none {isSortAsc
                          ? 'text-cyan-400'
                          : 'hover:text-cyan-300 focus:text-cyan-300'}"
                        aria-label={i18n.t('grid.sortAsc', { name: columnLabels?.[ci] ?? columnLetter(ci) })}
                        onmousedown={event => event.stopPropagation()}
                        onclick={() => editable && sort.handleSortClick(ci, 'asc')}
                        disabled={!editable}>
                        <!-- The caret is cropped tight to the triangle, so `size`
                             is the width it renders at (0.8125 × 10). -->
                        <CaretUpIcon size={10} />
                      </button>
                      <button
                        type="button"
                        class="flex leading-none transition-colors outline-none {isSortDesc
                          ? 'text-cyan-400'
                          : 'hover:text-cyan-300 focus:text-cyan-300'}"
                        aria-label={i18n.t('grid.sortDesc', { name: columnLabels?.[ci] ?? columnLetter(ci) })}
                        onmousedown={event => event.stopPropagation()}
                        onclick={() => editable && sort.handleSortClick(ci, 'desc')}
                        disabled={!editable}>
                        <CaretDownIcon size={10} />
                      </button>
                    </span>
                  </span>
                  {#if editable}
                    <button
                      type="button"
                      class="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize border-0 bg-transparent p-0 outline-none hover:bg-cyan-500/40 focus-visible:bg-cyan-500/40 {ci <
                      model.columnCount - 1
                        ? 'translate-x-1/2'
                        : ''}"
                      aria-label={i18n.t('grid.resizeColumn', { index: ci + 1 })}
                      onmousedown={event => columns.resize.startColumnResize(event, ci)}
                      onkeydown={event => columns.resize.handleResizeKeydown(event, ci)}></button>
                  {/if}
                </th>
              {/each}
            </tr>
            {#if showHeaders && model.rowCount > 0}
              <tr aria-rowindex="2" class="sticky top-6 z-20 bg-slate-900">
                <th
                  role="columnheader"
                  class="sticky top-6 left-0 z-30 w-9 border-r border-b border-r-slate-500 border-b-slate-600 bg-slate-900 p-0 text-center font-normal"
                  style="min-width:2.25rem;max-width:2.25rem;{rowNumberBorderStyle(sel.isCellSelected(0, 0))}"></th>
                {#each model.rows[0].cells as cell, ci (cell.id)}
                  <th
                    use:cellRefs.cellBoxRef={{ ri: 0, ci }}
                    role="columnheader"
                    aria-colindex={ci + 1}
                    aria-selected={sel.isCellSelected(0, ci)}
                    class={gridCellClass(
                      'min-w-32 border-r border-b border-r-slate-800 border-b-slate-600 p-0 font-semibold outline-none',
                      sel.isCellSelected(0, ci),
                    )}
                    style={cellStyles(
                      ci,
                      rangeHighlightStyle(
                        sel.isCellSelected(0, ci),
                        sel.isCellSelected(0, ci + 1),
                        sel.isCellSelected(1, ci),
                      ),
                      false,
                    )}
                    tabindex="-1"
                    onmousedown={event => sel.handleCellMousedown(event, 0, ci)}
                    ondblclick={event => sel.handleCellDoubleClick(event, 0, ci)}
                    onmouseenter={() => sel.handleCellMouseOver(0, ci)}
                    onkeydown={event => sel.handleBoxKeydown(event, 0, ci)}
                    onpaste={event => editor.handleBoxPaste(event, 0, ci)}>
                    <textarea
                      use:cellRefs.cellInputRef={{ ri: 0, ci }}
                      data-row={0}
                      data-col={ci}
                      rows={editor.isCellEditing(0, ci) && cell.value.includes('\n') ? 2 : 1}
                      wrap="off"
                      class="w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800"
                      value={cell.value}
                      readonly={!editable}
                      oninput={event => editable && model.setValue(0, ci, event.currentTarget.value)}
                      onfocus={() => {
                        editor.handleInputFocus(0, ci)
                        focus.cellInputAtEnd(0, ci)
                      }}
                      onblur={() => editor.handleBodyBlur()}
                      onkeydown={event => editable && editor.handleInputKeydown(event, 0, ci)}></textarea>
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
        aria-rowcount={model.rowCount + 1}
        aria-colcount={model.columnCount}
        class="border-separate border-spacing-0 border-l border-slate-800 text-sm"
        style={columns.renderedColumnWidths.length > 0
          ? `table-layout:fixed;width:${columns.totalWidth}px;`
          : 'width:100%;'}>
        {#if columns.renderedColumnWidths.length > 0}
          <colgroup>
            <col style="width:2.25rem;" />
            {#each Array.from({ length: model.columnCount }) as _, ci}
              <col style="width:{columns.renderedColumnWidths[ci]}px;" />
            {/each}
          </colgroup>
        {/if}
        {#if model.rowCount > 0}
          <tbody>
            {#each showHeaders ? model.rows.slice(1) : model.rows as row, ri (row.id)}
              {@const actualRi = showHeaders ? ri + 1 : ri}
              <tr aria-rowindex={showHeaders ? ri + 3 : ri + 2} class={gridRowClass(actualRi)}>
                <td
                  use:cellRefs.rowSelectorRef={{ ri: actualRi }}
                  role="rowheader"
                  aria-rowindex={showHeaders ? ri + 3 : ri + 2}
                  aria-selected={sel.selectedRows.has(actualRi)}
                  class="select-none {rowSelectorClass(actualRi, sel.isRowSelected(actualRi))}"
                  style={rowNumberBorderStyle(sel.isCellSelected(actualRi, 0))}
                  data-row-selector={actualRi}
                  tabindex="-1"
                  onmousedown={event => sel.handleRowSelectorMousedown(event, actualRi)}
                  onmouseenter={() => sel.handleRowSelectorMouseOver(actualRi)}
                  onkeydown={event => sel.handleRowSelectorKeydown(event, actualRi)}>
                  <span class="px-1.5 text-xs text-slate-500">{ri + 1}</span>
                </td>
                {#each row.cells as cell, ci (cell.id)}
                  {@const lineCount = cell.value.split('\n').length}
                  {@const expanded = editor.isCellEditing(actualRi, ci) && lineCount > 1}
                  {@const editorLines = Math.min(lineCount, EDITOR_MAX_LINES)}
                  <td
                    use:cellRefs.cellBoxRef={{ ri: actualRi, ci }}
                    role="gridcell"
                    aria-colindex={ci + 1}
                    aria-selected={sel.isCellSelected(actualRi, ci)}
                    class={gridCellClass(
                      'min-w-32 border-r border-b border-slate-800 p-0 outline-none',
                      sel.isCellSelected(actualRi, ci),
                    )}
                    style={cellStyles(
                      ci,
                      rangeHighlightStyle(
                        sel.isCellSelected(actualRi, ci),
                        sel.isCellSelected(actualRi, ci + 1),
                        sel.isCellSelected(actualRi + 1, ci),
                      ),
                      expanded,
                    )}
                    tabindex="-1"
                    onmousedown={event => sel.handleCellMousedown(event, actualRi, ci)}
                    ondblclick={event => sel.handleCellDoubleClick(event, actualRi, ci)}
                    onmouseenter={() => sel.handleCellMouseOver(actualRi, ci)}
                    onkeydown={event => sel.handleBoxKeydown(event, actualRi, ci)}
                    onpaste={event => editor.handleBoxPaste(event, actualRi, ci)}>
                    <textarea
                      use:cellRefs.cellInputRef={{ ri: actualRi, ci }}
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
                      onfocus={() => editor.handleInputFocus(actualRi, ci)}
                      onblur={() => editor.handleBodyBlur()}
                      onkeydown={event => editable && editor.handleInputKeydown(event, actualRi, ci)}></textarea>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        {/if}
      </table>

      {#if model.rowCount === 0}
        <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-400">
          <span>{i18n.t('grid.noContent')}</span>
          <Button variant="secondary" {size} onClick={() => sel.addRow()} disabled={!editable}>{i18n.t('grid.addRow')}</Button>
        </div>
      {/if}
    </div>
  </div>
</div>
