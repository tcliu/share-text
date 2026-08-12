<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'
  import Checkbox from './Checkbox.svelte'
  import Pagination from './Pagination.svelte'
  import SearchInput from './SearchInput.svelte'
  import Spinner from './Spinner.svelte'

  export type SortDirection = 'asc' | 'desc'

  export interface DataTableColumn<T> {
    key: string
    header: string
    widthClass?: string
    minWidthClass?: string
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

  interface Props<T> {
    rows: T[]
    rowId: (row: T) => string
    columns: DataTableColumn<T>[]
    loading?: boolean
    emptyMessage?: string
    searchValue?: string
    searchAriaLabel: string
    searchPlaceholder?: string
    searchKeys?: string[]
    onSearchInput?: (event: Event) => void
    onSearchKeydown?: (event: KeyboardEvent) => void
    selectable?: boolean
    selectedIds?: Set<string>
    onToggleSelection?: (id: string, checked: boolean) => void
    onToggleAll?: () => void
    allSelected?: boolean
    someSelected?: boolean
    selectAllAriaLabel?: string
    rowSelectAriaLabel?: (row: T) => string
    total: number
    pageSize: number
    currentPage: number
    onPageChange: (page: number) => void
    onPageSizeChange: (size: number) => void
    containerClass?: string
    tableClass?: string
    sortKey?: string | null
    sortDirection?: SortDirection
    onSort?: (key: string, direction: SortDirection) => void
    sortAriaLabel?: (column: DataTableColumn<T>) => string
  }

  let {
    rows,
    rowId,
    columns,
    loading = false,
    emptyMessage = 'No rows yet.',
    searchValue = $bindable(''),
    searchAriaLabel,
    searchPlaceholder = 'Search...',
    searchKeys = $bindable([] as string[]),
    onSearchInput,
    onSearchKeydown,
    selectable = false,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    allSelected = false,
    someSelected = false,
    selectAllAriaLabel = 'Select all',
    rowSelectAriaLabel,
    total,
    pageSize,
    currentPage,
    onPageChange,
    onPageSizeChange,
    containerClass = 'max-h-[min(50vh,32rem)] overflow-auto rounded-xl border border-slate-800 bg-slate-950/50 contain-layout',
    tableClass = 'min-w-[60rem]',
    sortKey = $bindable(null as string | null),
    sortDirection = $bindable('asc' as SortDirection),
    onSort,
    sortAriaLabel,
  }: Props<T> = $props()

  const columnCount = $derived(columns.length + (selectable ? 1 : 0))

  const cssLengthRe = /^\d+(\.\d+)?(px|rem|em|ch|vw|vh|fr)$/

  function invalidWidth(key: string, value: string | number, property: 'width' | 'min-width') {
    console.error(
      `DataTable: ignoring invalid ${property} for column "${key}" — use a number of pixels or a string ending in "%" (or a valid CSS length).`,
      value,
    )
  }

  const resolvedColumns = $derived.by(() => {
    const pctWidthColumns = columns.filter(
      c =>
        c.widthClass === undefined &&
        typeof c.width === 'string' &&
        c.width.endsWith('%') &&
        !Number.isNaN(Number.parseFloat(c.width)),
    )
    const pctSum = pctWidthColumns.reduce((sum, c) => sum + Number.parseFloat(c.width as string), 0)
    const rebaseFactor = pctSum > 0 ? 100 / pctSum : 1

    return columns.map(column => {
      let widthStyle: string | undefined
      if (column.widthClass === undefined && column.width !== undefined) {
        if (typeof column.width === 'number') {
          if (Number.isFinite(column.width) && column.width >= 0) {
            widthStyle = `width: ${column.width}px`
          } else {
            invalidWidth(column.key, column.width, 'width')
          }
        } else if (column.width.endsWith('%')) {
          const pct = Number.parseFloat(column.width)
          if (Number.isNaN(pct)) {
            invalidWidth(column.key, column.width, 'width')
          } else {
            widthStyle = `width: ${(pct * rebaseFactor).toFixed(2)}%`
          }
        } else if (cssLengthRe.test(column.width)) {
          widthStyle = `width: ${column.width}`
        } else {
          invalidWidth(column.key, column.width, 'width')
        }
      }

      let minWidthStyle: string | undefined
      if (column.minWidthClass === undefined && column.minWidth !== undefined) {
        if (typeof column.minWidth === 'number' && Number.isFinite(column.minWidth) && column.minWidth >= 0) {
          minWidthStyle = `min-width: ${column.minWidth}px`
        } else if (typeof column.minWidth === 'string' && (column.minWidth.endsWith('%') || cssLengthRe.test(column.minWidth))) {
          minWidthStyle = `min-width: ${column.minWidth}`
        } else {
          invalidWidth(column.key, column.minWidth, 'min-width')
        }
      }

      return { ...column, widthStyle, minWidthStyle }
    })
  })

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

  function handleSortClick(column: DataTableColumn<T>, direction: SortDirection) {
    if (!column.sortable) {
      return
    }
    sortKey = column.key
    sortDirection = direction
    onSort?.(column.key, direction)
  }
</script>

<div class="flex flex-col gap-2">
  <SearchInput
    bind:value={searchValue}
    oninput={onSearchInput}
    onkeydown={onSearchKeydown}
    ariaLabel={searchAriaLabel}
    placeholder={searchPlaceholder} />

  <div class={containerClass}>
    <table
      class="w-full border-separate border-spacing-0 text-sm [&_tr:last-child_td]:border-b-0 {tableClass}">
      <thead>
        <tr class="text-left text-sm font-medium text-slate-500">
          {#if selectable}
            <th
              class="sticky top-0 z-10 w-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                ariaLabel={selectAllAriaLabel}
                disabled={rows.length === 0}
                onChange={() => onToggleAll?.()} />
            </th>
          {/if}
          {#each resolvedColumns as column (column.key)}
            {@const isActive = sortKey === column.key}
            {@const isAsc = isActive && sortDirection === 'asc'}
            {@const isDesc = isActive && sortDirection === 'desc'}
            <th
              class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur {column.widthClass} {column.minWidthClass} {column.sortable ? 'group' : ''}"
              style={[column.widthStyle, column.minWidthStyle].filter(Boolean).join('; ')}
              aria-sort={isActive ? (isAsc ? 'ascending' : 'descending') : undefined}>
              {#if column.sortable}
                <span class="flex w-full items-center gap-2 text-left">
                  <span>{column.header}</span>
                  <span
                    class="flex flex-col text-slate-400 transition-opacity {isActive ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100">
                    <button
                      type="button"
                      class="leading-none transition-colors {isAsc ? 'text-cyan-400' : 'hover:text-cyan-300'}"
                      aria-label={sortAriaLabel?.(column) ?? `Sort ${column.header} ascending`}
                      onclick={() => handleSortClick(column, 'asc')}>
                      <svg viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                        <path d="M10 4l6 8H4l6-8Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="-mt-1 leading-none transition-colors {isDesc ? 'text-cyan-400' : 'hover:text-cyan-300'}"
                      aria-label={sortAriaLabel?.(column) ?? `Sort ${column.header} descending`}
                      onclick={() => handleSortClick(column, 'desc')}>
                      <svg viewBox="0 0 20 20" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                        <path d="M10 16 4 8h12l-6 8Z" />
                      </svg>
                    </button>
                  </span>
                </span>
              {:else}
                {column.header}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if loading && rows.length === 0}
          <tr>
            <td colspan={columnCount} class="px-3 py-10">
              <div class="flex justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            </td>
          </tr>
        {:else if rows.length === 0}
          <tr>
            <td colspan={columnCount} class="px-3 py-10 text-center text-sm text-slate-500">{emptyMessage}</td>
          </tr>
        {:else}
          {#each rows as row (rowId(row))}
            <tr class="hover:bg-slate-900/40">
              {#if selectable}
                <td class="border-b border-slate-800/50 px-3 py-2">
                  <Checkbox
                    checked={selectedIds?.has(rowId(row)) ?? false}
                    ariaLabel={rowSelectAriaLabel?.(row) ?? 'Select row'}
                    onChange={checked => onToggleSelection?.(rowId(row), checked)} />
                </td>
              {/if}
              {#each resolvedColumns as column (column.key)}
                <td
                  class="border-b border-slate-800/50 px-3 py-2 {column.minWidthClass} {column.cellClass}"
                  style={column.minWidthStyle}>
                  {@render column.cell?.(row)}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <div class="shrink-0">
    <Pagination
      {total}
      {pageSize}
      currentPage={currentPage}
      {onPageChange}
      {onPageSizeChange} />
  </div>
</div>
