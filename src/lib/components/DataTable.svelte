<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'
  import Checkbox from './Checkbox.svelte'
  import ColumnChooser, { type ChooserColumn } from './ColumnChooser.svelte'
  import Pagination from './Pagination.svelte'
  import type { PaginationLabels } from './pagination-labels'
  import SearchInput from './SearchInput.svelte'
  import Spinner from './Spinner.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import CaretDownIcon from '$lib/icons/CaretDownIcon.svelte'
  import CaretUpIcon from '$lib/icons/CaretUpIcon.svelte'
  import { createTableColumns, TABLE_MIN_COLUMN_WIDTH, TABLE_SELECT_COLUMN_WIDTH } from './use-table-columns.svelte'
  import { createTableScrollSync } from './use-table-scroll-sync.svelte'
  import { resolveColumnWidths } from '$lib/data-table/column-helpers'
  import Tooltip from './Tooltip.svelte'

  export type SortDirection = 'asc' | 'desc'

  export interface DataTableColumn<T> {
    key: string
    header: string
    widthClass?: string
    minWidthClass?: string
    // Marks a numeric column: right-aligns the header (via the existing
    // `thead th.num` table style) alongside right-aligned numeric cells.
    // Suppressed when `headerAlign` is set, so an explicit alignment wins.
    num?: boolean
    // Header tooltip, rendered with the positioned Tooltip component.
    headerTip?: string
    // Header text alignment; cells keep their own alignment. Rendered as an
    // inline style (runtime values must not rely on generated utilities, and
    // an inline style wins over global element rules). Unset by default so
    // existing callers are unchanged. For a sortable center header the label
    // itself is centered and the two-arrow control is pinned to the header's
    // right edge, so the (usually invisible) arrows never pull the label off
    // center and hovering reveals them without shifting it. The label row
    // keeps only a small symmetric gutter; sized columns keep headroom so a
    // long label shows an ellipsis before sliding under the arrows.
    headerAlign?: 'left' | 'center' | 'right'
    // When widthClass / minWidthClass is omitted, they are derived from these:
    // a number is pixels, a string ending in '%' is a percentage (rebased so
    // percentage columns sum to 100%), any other string must be a valid CSS
    // length (e.g. '20rem'); malformed values are ignored and reported.
    width?: string | number
    minWidth?: string | number
    cellClass?: string
    cell?: Snippet<[T]>
    sortable?: boolean
    searchable?: boolean
  }

  // Pagination footer configuration: the data plus the callbacks the footer
  // needs. `total`/`pageSize`/`currentPage`/`onPageChange` together gate the
  // footer; `onPageSizeChange` adds the page-size selector; `labels` and
  // `trailing` pass straight through to Pagination.
  export interface DataTablePagination {
    total?: number
    pageSize?: number
    currentPage?: number
    onPageChange?: (page: number) => void
    onPageSizeChange?: (size: number) => void
    // Page-size choices offered by the footer's dropdown; defaults to [10, 20, 50].
    pageSizeOptions?: number[]
    labels?: PaginationLabels
    trailing?: Snippet
  }

  interface Props<T> {
    rows: T[]
    rowId: (row: T) => string
    columns: DataTableColumn<T>[]
    loading?: boolean
    emptyMessage?: string
    searchValue?: string
    searchAriaLabel?: string
    searchPlaceholder?: string
    showSearch?: boolean
    // Derived by DataTable from `columns[].searchable` and written back through
    // the binding: read it (`bind:searchKeys`) rather than pass it — any value
    // supplied is recomputed and overwritten whenever the columns change.
    searchKeys?: string[]
    onSearchInput?: (event: Event) => void
    onSearchKeydown?: (event: KeyboardEvent) => void
    // Column selector + reset icons rendered in the toolbar after the search
    // box. The chooser is omitted entirely when `chooserColumns` is undefined.
    chooserColumns?: ChooserColumn[]
    chooserLabel?: string
    chooserResetLabel?: string
    onToggleColumn?: (key: string, checked: boolean) => void
    onResetColumns?: () => void
    selectable?: boolean
    selectedIds?: Set<string>
    onToggleSelection?: (id: string, checked: boolean) => void
    onToggleAll?: () => void
    allSelected?: boolean
    someSelected?: boolean
    selectAllAriaLabel?: string
    rowSelectAriaLabel?: (row: T) => string
    // Pagination footer configuration. The footer renders only when the
    // object supplies `total`, `pageSize`, `currentPage`, and `onPageChange`;
    // `onPageSizeChange` is optional (without it the footer hides the
    // page-size selector). Omitted entirely for the pagination-free
    // (docs-table) mode.
    pagination?: DataTablePagination
    containerClassName?: string
    tableClassName?: string
    fillHeight?: boolean
    // Splits the header into a fixed band outside the scrollport (only with
    // fillHeight): the body wrapper scrolls while the header mirrors its
    // horizontal scroll, so the vertical scrollbar spans body rows only.
    bodyScroll?: boolean
    // Renders the pagination footer. Set false for short summary tables that
    // always fit one page (the dashboard breakdowns). Unset, the footer renders
    // when `pagination` supplies its data and `onPageChange`; omitting it is the
    // pagination-free (docs-table) mode. `onPageSizeChange` is optional.
    showPagination?: boolean
    // Compact header/cell padding for summary tables embedded in a panel.
    // Applied inline so it wins over the viewer table rules.
    dense?: boolean
    // Card chrome (border, rounding, translucent backdrop) on the viewer and
    // split containers. Set false for borderless embedding (e.g. FieldTable's
    // docs tables, which sit directly on the page canvas).
    bordered?: boolean
    // Presentation variant. `data` (default) is the paged viewer with its
    // scroll container, sticky header, and row hover. `docs` is the static
    // documentation table: plain overflow wrapper, non-sticky header, no hover.
    variant?: 'data' | 'docs'
    sortKey?: string | null
    sortDirection?: SortDirection
    onSort?: (key: string, direction: SortDirection) => void
    sortAriaLabel?: (column: DataTableColumn<T>, direction: SortDirection) => string
    resizeAriaLabel?: (column: DataTableColumn<T>) => string
    // Adds draggable (and arrow-key) resize handles to each data column header.
    // Off by default; the selectable checkbox column stays fixed.
    resizable?: boolean
    // When set, resized column widths are persisted to localStorage under this
    // key and restored on mount.
    storageKey?: string
    // Rising signal from the column chooser's reset action: each new value
    // drops managed widths (and their persisted copy) so the table falls
    // back to the percentage layout.
    resetWidthsSignal?: number
    size?: SizeInput
  }

  let {
    rows,
    rowId,
    columns,
    loading = false,
    emptyMessage,
    searchValue = $bindable(''),
    searchAriaLabel,
    searchPlaceholder,
    showSearch = true,
    searchKeys = $bindable([] as string[]),
    onSearchInput,
    onSearchKeydown,
    chooserColumns,
    chooserLabel,
    chooserResetLabel,
    onToggleColumn,
    onResetColumns,
    selectable = false,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    allSelected = false,
    someSelected = false,
    selectAllAriaLabel,
    rowSelectAriaLabel,
    pagination,
    containerClassName,
    tableClassName = 'min-w-0',
    fillHeight = false,
    bodyScroll = false,
    showPagination,
    dense = false,
    bordered = true,
    variant = 'data',
    sortKey = $bindable(null as string | null),
    sortDirection = $bindable('asc' as SortDirection),
    onSort,
    sortAriaLabel,
    resizeAriaLabel,
    resizable = false,
    storageKey,
    resetWidthsSignal = 0,
    size = 'md',
  }: Props<T> = $props()

  const resolvedEmptyMessage = $derived(emptyMessage ?? 'No rows')
  const resolvedSearchPlaceholder = $derived(searchPlaceholder ?? 'Search')
  const resolvedSearchAriaLabel = $derived(searchAriaLabel ?? 'Search')
  const resolvedChooserLabel = $derived(chooserLabel ?? 'Choose columns')
  const resolvedChooserResetLabel = $derived(chooserResetLabel ?? 'Reset columns')
  const resolvedSelectAllAriaLabel = $derived(selectAllAriaLabel ?? 'Select all')

  // Pagination is configured when the object supplies its data and the
  // page-change handler, so omitting any of them renders no footer. An explicit
  // `showPagination` still wins, and `onPageSizeChange` stays optional: without
  // it the footer renders but hides the page-size selector.
  const resolvedPagination = $derived.by(() => {
    if (
      pagination?.total != null &&
      pagination.pageSize != null &&
      pagination.currentPage != null &&
      pagination.onPageChange
    ) {
      return {
        total: pagination.total,
        pageSize: pagination.pageSize,
        currentPage: pagination.currentPage,
        onPageChange: pagination.onPageChange,
        onPageSizeChange: pagination.onPageSizeChange,
        pageSizeOptions: pagination.pageSizeOptions,
        labels: pagination.labels,
        trailing: pagination.trailing,
      }
    }
    return null
  })
  const showFooter = $derived((showPagination ?? resolvedPagination != null) && resolvedPagination != null)

  const isDocs = $derived(variant === 'docs')
  // Card chrome shared by the viewer containers; dropped when bordered is false.
  const viewerChromeClass = 'rounded-xl border border-slate-800 bg-slate-950/50'
  const resolvedContainerClass = $derived(
    containerClassName ??
      (isDocs
        ? 'overflow-x-auto'
        : `max-h-[min(70vh,44rem)] overflow-auto contain-layout ${bordered ? viewerChromeClass : ''}`),
  )
  // Docs chrome mirrors the documentation table: collapsed borders, plain
  // non-sticky header, no row hover. The trailing cell pad is dropped on the
  // last column, like the old docs table. The data viewer keeps its own chrome.
  const tableChromeClass = $derived(
    isDocs
      ? 'border-collapse text-left [&_th:last-child]:pr-0 [&_td:last-child]:pr-0'
      : 'border-separate border-spacing-0 [&_tr:last-child_td]:border-b-0',
  )
  const headerCellBase = $derived(
    isDocs
      ? 'border-b border-slate-700 py-2 pr-3 font-medium'
      : 'sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur',
  )
  const bodyCellBase = $derived(
    isDocs ? 'border-b border-slate-800 py-2 pr-3 align-top' : 'border-b border-slate-800/50 px-3 py-2',
  )
  const bodyRowClass = $derived(isDocs ? '' : 'hover:bg-slate-900/40')

  const columnCount = $derived(columns.length + (selectable ? 1 : 0))

  const fillContainerClass = $derived(
    bordered
      ? 'min-h-0 overflow-auto rounded-xl border border-slate-800 bg-slate-950/50 contain-layout'
      : 'min-h-0 overflow-auto contain-layout',
  )

  // Split header/body mode: the header lives in a fixed band outside the
  // scrollport and only the body wrapper scrolls (requires fillHeight, which
  // provides the bounded flex height). Off by default so existing callers
  // keep the single-table sticky-header rendering.
  const splitHeader = $derived(bodyScroll && fillHeight)

  const splitFrameClass = $derived(
    bordered
      ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 contain-layout'
      : 'flex min-h-0 flex-1 flex-col overflow-hidden contain-layout',
  )

  let headerWrapper = $state<HTMLElement | null>(null)

  // Mirror the body wrapper's scroll into the header band, forward header wheel
  // events, and pad the header by the body's scrollbar width. The getters
  // return null while the split-header layout is off, so the effects stay inert
  // until it turns on (and re-run when it changes).
  createTableScrollSync({
    getBody: () => (splitHeader ? tableContainer : null),
    getHeader: () => (splitHeader ? headerWrapper : null),
    padHeaderForScrollbar: true,
  })

  const resolvedColumns = $derived.by(() => resolveColumnWidths(columns))

  $effect(() => {
    const keys = columns.map(c => c.key)
    if (new Set(keys).size !== keys.length) {
      console.error('DataTable: duplicate column keys detected — each column key must be unique.', keys)
    }
  })

  $effect(() => {
    const keys = columns.filter(c => c.searchable).map(c => c.key)
    if (keys.join(',') !== searchKeys.join(',')) {
      searchKeys = keys
    }
  })

  // --- Column resize (opt-in via `resizable`) ---
  //
  // Each data column header hosts a splitter. Dragging the splitter between
  // columns i and i+1 re-partitions those two adjacent columns within a fixed
  // combined total; the splitter after the last column moves the table's right
  // edge. The width engine (managed widths, persistence, and the shared resize
  // composable) lives in `use-table-columns`; the component keeps the DOM refs.

  let tableContainer = $state<HTMLElement | null>(null)
  let headerEls = $state<(HTMLElement | null)[]>([])

  /** Scroll the body scrollport (used by scroll-chevron controls above the table). */
  export function scrollBodyTo(options: ScrollToOptions): void {
    tableContainer?.scrollTo(options)
  }

  const tableColumns = createTableColumns({
    getColumns: () => columns,
    getResizable: () => resizable,
    getSelectable: () => selectable,
    getStorageKey: () => storageKey,
    getResetSignal: () => resetWidthsSignal,
    getContainer: () => tableContainer,
    getColumnCellWidth: (i: number) => headerEls[i]?.offsetWidth ?? TABLE_MIN_COLUMN_WIDTH,
    // bind:this grows headerEls but never shrinks it; drop stale tail refs so a
    // shrinking column list can't serve a detached header's width.
    pruneHeaderRefs: count => {
      if (headerEls.length > count) headerEls = headerEls.slice(0, count)
    },
  })

  // Both split tables share one column template so their columns stay
  // aligned: managed pixel widths once resized, otherwise the declared
  // widths (fixed layout governs both tables in split mode).
  const splitTableClass = $derived(tableColumns.managedWidths ? 'min-w-full' : `w-full ${tableClassName}`)
  const splitTableStyle = $derived(
    tableColumns.managedWidths
      ? `table-layout:fixed;min-width:100%;width:${tableColumns.totalWidth}px;`
      : 'table-layout:fixed;',
  )

  function handleSortClick(column: DataTableColumn<T>, direction: SortDirection) {
    if (!column.sortable) {
      return
    }
    sortKey = column.key
    sortDirection = direction
    onSort?.(column.key, direction)
  }
</script>

<svelte:window onmouseup={tableColumns.resize.handleResizeMouseUp} onmousemove={tableColumns.resize.handleResizeMouseMove} />

<div class="flex w-full min-w-0 flex-col gap-2 {fillHeight ? 'min-h-0 flex-1' : ''}">
  {#if showSearch || chooserColumns}
    <div class="flex flex-wrap items-center gap-2 {fillHeight ? 'shrink-0' : ''}">
      {#if showSearch}
        <SearchInput
          bind:value={searchValue}
          {size}
          oninput={onSearchInput}
          onkeydown={onSearchKeydown}
          ariaLabel={resolvedSearchAriaLabel}
          placeholder={resolvedSearchPlaceholder}
          wrapperClass="min-w-0 flex-1" />
      {/if}
      {#if chooserColumns}
        <ColumnChooser
          triggerLabel={resolvedChooserLabel}
          resetAriaLabel={resolvedChooserResetLabel}
          columns={chooserColumns}
          {size}
          onToggle={(key, checked) => onToggleColumn?.(key, checked)}
          onReset={() => onResetColumns?.()} />
      {/if}
    </div>
  {/if}

  {#snippet tableColgroup()}
    {#if tableColumns.managedWidths}
      <colgroup>
        {#if selectable}
          <col style="width:{TABLE_SELECT_COLUMN_WIDTH}px;" />
        {/if}
        {#each Array.from({ length: columns.length }) as _, i}
          <col style="width:{tableColumns.columnWidths[i]}px;" />
        {/each}
      </colgroup>
    {:else if splitHeader}
      <colgroup>
        {#if selectable}
          <col style="width:{TABLE_SELECT_COLUMN_WIDTH}px;" />
        {/if}
        {#each resolvedColumns as column (column.key)}
          <col style={column.widthStyle} />
        {/each}
      </colgroup>
    {/if}
  {/snippet}

  {#snippet tableBody()}
    {#if loading && rows.length === 0}
      <tr>
        <td colspan={columnCount} class="px-3 py-10">
          <div class="flex justify-center">
            <Spinner {size} />
          </div>
        </td>
      </tr>
    {:else if rows.length === 0}
      <tr>
        <td colspan={columnCount} class="px-3 py-10 text-center text-sm text-slate-400">{resolvedEmptyMessage}</td>
      </tr>
    {:else}
      {#each rows as row (rowId(row))}
        <tr class={bodyRowClass}>
          {#if selectable}
            <td class="border-b border-slate-800/50 px-3 py-2">
              <Checkbox
                checked={selectedIds?.has(rowId(row)) ?? false}
                {size}
                ariaLabel={rowSelectAriaLabel?.(row) ?? 'Select row'}
                onChange={checked => onToggleSelection?.(rowId(row), checked)} />
            </td>
          {/if}
          {#each resolvedColumns as column (column.key)}
            <td
              class="{bodyCellBase} {tableColumns.managedWidths
                ? ''
                : column.minWidthClass} {column.cellClass}"
              style={[
                tableColumns.managedWidths ? '' : column.minWidthStyle,
                dense ? 'padding: 4px 8px; font-size: 12px' : '',
              ]
                .filter(Boolean)
                .join('; ')}>
              {@render column.cell?.(row)}
            </td>
          {/each}
        </tr>
      {/each}
    {/if}
  {/snippet}

  {#snippet headerRow()}
    <tr class="text-left text-sm font-medium text-slate-400">
      {#if selectable}
        <th class="sticky top-0 z-10 w-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            {size}
            ariaLabel={resolvedSelectAllAriaLabel}
            disabled={rows.length === 0}
            onChange={() => onToggleAll?.()} />
        </th>
      {/if}
      {#each resolvedColumns as column, i (column.key)}
        {@const isActive = sortKey === column.key}
        {@const isAsc = isActive && sortDirection === 'asc'}
        {@const isDesc = isActive && sortDirection === 'desc'}
        {@const headerAlignStyle =
          column.headerAlign === 'center'
            ? 'text-align: center'
            : column.headerAlign === 'right'
              ? 'text-align: right'
              : column.headerAlign === 'left'
                ? 'text-align: left'
                : ''}
        {@const centerHeader = column.headerAlign === 'center'}
        <th
          bind:this={headerEls[i]}
          scope="col"
          class="{headerCellBase} {column.sortable ? 'group' : ''} {column.num ? 'num' : ''} {tableColumns.managedWidths
            ? ''
            : column.widthClass} {tableColumns.managedWidths ? '' : column.minWidthClass}"
          style={[
            headerAlignStyle,
            tableColumns.managedWidths ? '' : column.widthStyle,
            tableColumns.managedWidths ? '' : column.minWidthStyle,
            dense ? 'padding: 4px 8px; font-size: 12px' : '',
          ]
            .filter(Boolean)
            .join('; ')}
          data-col-index={i}
          aria-sort={isActive ? (isAsc ? 'ascending' : 'descending') : undefined}>
          {#if column.headerTip}
            <Tooltip>{column.headerTip}</Tooltip>
          {/if}
          {#if column.sortable}
            <span class="flex w-full items-center gap-2 text-left {centerHeader ? 'relative justify-center px-1' : ''}">
              <span class={centerHeader ? 'min-w-0 overflow-hidden break-words text-ellipsis' : ''}
                >{column.header}</span>
              <span
                class="flex flex-col gap-0.5 {centerHeader
                  ? 'absolute top-1/2 right-0 -translate-y-1/2'
                  : ''} text-slate-400 transition-opacity {isActive
                  ? 'opacity-100'
                  : '[@media(hover:hover)]:opacity-0'} group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  class="flex leading-none transition-colors outline-none {isAsc
                    ? 'text-cyan-400'
                    : 'hover:text-cyan-300 focus:text-cyan-300'}"
                  aria-label={sortAriaLabel?.(column, 'asc') ?? `Sort ${column.header} ascending`}
                  onclick={() => handleSortClick(column, 'asc')}>
                  <!-- The caret is cropped tight to the triangle, so `size` is the
                       width it renders at (0.8125 × 10) rather than a square box. -->
                  <CaretUpIcon size={10} />
                </button>
                <button
                  type="button"
                  class="flex leading-none transition-colors outline-none {isDesc
                    ? 'text-cyan-400'
                    : 'hover:text-cyan-300 focus:text-cyan-300'}"
                  aria-label={sortAriaLabel?.(column, 'desc') ?? `Sort ${column.header} descending`}
                  onclick={() => handleSortClick(column, 'desc')}>
                  <CaretDownIcon size={10} />
                </button>
              </span>
            </span>
          {:else}
            {column.header}
          {/if}
          {#if resizable}
            <button
              type="button"
              class="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize border-0 bg-transparent p-0 outline-none hover:bg-cyan-500/40 focus-visible:bg-cyan-500/40 {i <
              columns.length - 1
                ? 'translate-x-1/2'
                : ''}"
              aria-label={resizeAriaLabel?.(column) ?? `Resize ${column.header}`}
              onmousedown={event => tableColumns.resize.startColumnResize(event, i)}
              onkeydown={event => tableColumns.resize.handleResizeKeydown(event, i)}></button>
          {/if}
        </th>
      {/each}
    </tr>
  {/snippet}

  {#if splitHeader}
    <div class={splitFrameClass}>
      <div class="flex-none overflow-hidden" bind:this={headerWrapper}>
        <table
          class="border-separate border-spacing-0 text-sm [&_tr:last-child_td]:border-b-0 {splitTableClass}"
          style={splitTableStyle}>
          {@render tableColgroup()}
          <thead>
            {@render headerRow()}
          </thead>
        </table>
      </div>
      <div tabindex="-1" class="min-h-0 flex-1 overflow-auto outline-none" bind:this={tableContainer}>
        <table
          class="border-separate border-spacing-0 text-sm [&_tr:last-child_td]:border-b-0 {splitTableClass}"
          style={splitTableStyle}>
          {@render tableColgroup()}
          <tbody>
            {@render tableBody()}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <div
      tabindex="-1"
      class={`${fillHeight ? fillContainerClass : resolvedContainerClass} outline-none`}
      bind:this={tableContainer}>
      <table
        class="{tableChromeClass} text-sm {tableColumns.managedWidths ? 'min-w-full' : `w-full ${tableClassName}`}"
        style={tableColumns.managedWidths
          ? `table-layout:fixed;min-width:100%;width:${tableColumns.totalWidth}px;`
          : ''}>
        {@render tableColgroup()}
        <thead>
          {@render headerRow()}
        </thead>
        <tbody>
          {@render tableBody()}
        </tbody>
      </table>
    </div>
  {/if}

  {#if showFooter && resolvedPagination}
    <!-- `&& resolvedPagination` narrows the derived object for the footer below. -->
    <div class="shrink-0">
      <Pagination
        total={resolvedPagination.total}
        pageSize={resolvedPagination.pageSize}
        currentPage={resolvedPagination.currentPage}
        {size}
        onPageChange={resolvedPagination.onPageChange}
        onPageSizeChange={resolvedPagination.onPageSizeChange}
        pageSizeOptions={resolvedPagination.pageSizeOptions}
        labels={resolvedPagination.labels}
        trailing={resolvedPagination.trailing} />
    </div>
  {/if}
</div>
