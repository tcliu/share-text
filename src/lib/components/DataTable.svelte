<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'
  import Checkbox from './Checkbox.svelte'
  import Pagination from './Pagination.svelte'
  import SearchInput from './SearchInput.svelte'
  import Spinner from './Spinner.svelte'

  export interface DataTableColumn<T> {
    key: string
    header: string
    widthClass?: string
    cellClass?: string
    cell?: Snippet<[T]>
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
  }: Props<T> = $props()

  const columnCount = $derived(columns.length + (selectable ? 1 : 0))

  $effect(() => {
    const keys = columns.map(c => c.key)
    if (new Set(keys).size !== keys.length) {
      console.error('DataTable: duplicate column keys detected — each column key must be unique.', keys)
    }
  })
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
      class="w-full border-separate border-spacing-0 text-[13px] [&_tr:last-child_td]:border-b-0 {tableClass}">
      <thead>
        <tr class="text-left text-xs font-medium text-slate-500">
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
          {#each columns as column (column.key)}
            <th
              class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur {column.widthClass}">
              {column.header}
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
            <td colspan={columnCount} class="px-3 py-10 text-center text-[13px] text-slate-500">{emptyMessage}</td>
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
              {#each columns as column (column.key)}
                <td class="border-b border-slate-800/50 px-3 py-2 {column.cellClass}">
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
