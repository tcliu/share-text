<script lang="ts">
  import type { Snippet } from 'svelte'
  import NumberInput from './NumberInput.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import ChevronLeftIcon from '$lib/icons/ChevronLeftIcon.svelte'
  import ChevronRightIcon from '$lib/icons/ChevronRightIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import type { PaginationLabels } from './pagination-labels'
  import { SELECT_RATIOS } from './select-dropdown-styles'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  const i18n = getI18nContext()

  interface Props {
    total: number
    pageSize: number
    currentPage: number
    size?: SizeInput
    className?: string
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    // Page-size choices offered by the dropdown; defaults to [10, 20, 50].
    pageSizeOptions?: number[]
    // Per-field label overrides; each unset field falls back to its i18n key.
    labels?: PaginationLabels
    // Arbitrary trailing content pinned to the pagination row's right edge
    // (e.g. a row total). Omitted when undefined.
    trailing?: Snippet
  }

  let {
    total,
    pageSize,
    currentPage,
    size = 'md',
    className = '',
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50],
    labels,
    trailing,
  }: Props = $props()

  // Derived (not plain consts) so locale switches re-resolve the labels.
  const resolvedPreviousLabel = $derived(labels?.previous ?? i18n.t('pagination.previous'))
  const resolvedNextLabel = $derived(labels?.next ?? i18n.t('pagination.next'))
  const resolvedPageSizeLabel = $derived(labels?.pageSize ?? i18n.t('pagination.pageSize'))
  const resolvedCurrentPageLabel = $derived(labels?.current ?? i18n.t('pagination.current'))
  const resolvedPaginationLabel = $derived(labels?.nav ?? i18n.t('pagination.label'))

  const PAGE_JUMP_DELTA = 2

  // Continuous chrome: every metric is a fixed ratio of the size dimension
  // (calibrated at the md default), so numeric sizes scale smoothly instead
  // of snapping to tiers. The raw size flows to the inner page-size dropdown,
  // which interpolates it through the same dimension. The line and vertical
  // padding are the page-size dropdown trigger's own, so every page block
  // lands on its height (see `pgStyle` below); the direction glyphs ride a
  // trimmed share of the icon slot (0.75×, as `NumberInput`'s steppers do) so
  // they read lighter than the page numbers.
  const PG_RATIOS = { line: SELECT_RATIOS.line, padY: SELECT_RATIOS.padY, padX: 0.75, font: 0.875, icon: 0.75 }

  const pgMetrics = $derived(dimensionMetrics(size, PG_RATIOS))
  // A page block shares the page-size dropdown trigger's box — the select line
  // plus its vertical padding, plus the 1px border top and bottom — so the page
  // buttons, the jump input, and the dropdown all sit at one height. Deriving
  // it from those ratios keeps the two from drifting when either box is tuned.
  const pgStyle = $derived(
    `${sizeVarStyle('pg', pgMetrics)};--pg-btn:calc(var(--pg-line) + 2 * var(--pg-pad-y) + 2px)`,
  )
  const pgIconPx = $derived(pgMetrics.icon)

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)))
  const canGoPrev = $derived(currentPage > 1)
  const canGoNext = $derived(currentPage < totalPages)

  const iconButtonClass =
    'relative inline-flex h-[var(--pg-btn)] w-[var(--pg-btn)] items-center justify-center rounded-md border border-slate-700 bg-slate-950 font-semibold text-slate-100 outline-none transition hover:border-cyan-500 hover:text-cyan-300 focus:border-cyan-500 focus:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40'

  // Sizing-only fragment shared by the page buttons and the ellipsis
  // placeholders (which carry no border, surface, or hover chrome).
  const pageButtonBox = 'h-[var(--pg-btn)] min-w-[var(--pg-btn)] px-[var(--pg-pad-x)]'

  const pageButtonClass =
    `relative inline-flex ${pageButtonBox} items-center justify-center rounded-md border border-slate-700 bg-slate-950 font-semibold text-slate-100 outline-none transition hover:border-cyan-500 hover:text-cyan-300 focus:border-cyan-500 focus:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40`

  const pageNumbers = $derived.by(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }
    const end = Math.min(totalPages, currentPage + PAGE_JUMP_DELTA)
    const start = Math.max(1, end - PAGE_JUMP_DELTA * 2)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  })

  const showStartEllipsis = $derived(pageNumbers[0] > 1)
  const showEndEllipsis = $derived(pageNumbers[pageNumbers.length - 1] < totalPages)

  let pageJumpInputValue = $state('')
  let pageJumpInput = $state<{ focus: () => void } | null>(null)
  // Set only by an Enter commit that actually navigates: the focused input
  // unmounts on navigation, so the effect below carries focus to the new
  // page's input. Mouse navigation never sets it and never steals focus.
  let refocusJumpInput = false
  let refocusFrame = 0
  // Set by any focusin elsewhere in the app (from a `<svelte:window>`
  // listener) so a fast Tab away is never overridden by the deferred refocus.
  let focusMovedAway = false

  $effect(() => {
    pageJumpInputValue = String(currentPage)
  })

  $effect(() => {
    currentPage
    pageJumpInput
    if (!refocusJumpInput) return
    refocusJumpInput = false
    focusMovedAway = false
    // Cancel any pending frame before scheduling a new one, and skip when
    // focus already moved on, so a fast Tab is never overridden.
    cancelAnimationFrame(refocusFrame)
    refocusFrame = requestAnimationFrame(() => {
      if (focusMovedAway) return
      pageJumpInput?.focus()
    })
  })

  // Width for the jump input: the widest page number plus the text being
  // typed, with the buttons' padding and border and a 2px caret allowance —
  // the same box as the page buttons, never clipped. Inline style because
  // runtime widths must not be utilities.
  const pageInputDigits = $derived(Math.max(1, String(totalPages).length, pageJumpInputValue.length))
  const pageInputStyle = $derived.by(() => {
    const pad = `${pgMetrics.padX}px`
    return `padding-left:${pad};padding-right:${pad};width:calc(${pageInputDigits}ch + 2 * ${pad} + 4px)`
  })

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) {
      return
    }
    onPageChange(page)
  }

  function changePageBy(delta: number) {
    goToPage(currentPage + delta)
  }

  // Commit the typed page; returns whether it navigated. Enter uses the result
  // to refocus the new input, blur discards it and only commits.
  function commitPageInput(): boolean {
    const parsed = Number.parseInt(pageJumpInputValue, 10)
    if (Number.isNaN(parsed)) {
      pageJumpInputValue = String(currentPage)
      return false
    }
    const clamped = Math.min(Math.max(parsed, 1), totalPages)
    if (clamped === currentPage) {
      pageJumpInputValue = String(currentPage)
      return false
    }
    onPageChange(clamped)
    return true
  }

  function handlePageInputBlur() {
    commitPageInput()
  }

  function handlePageInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      refocusJumpInput = commitPageInput()
    } else if (event.key === 'Escape') {
      pageJumpInputValue = String(currentPage)
    }
  }

  function handlePageSizeChange(value: string) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0 && parsed !== pageSize) {
      onPageSizeChange?.(parsed)
    }
  }

  function handleWindowFocusIn(): void {
    focusMovedAway = true
  }
</script>

<svelte:window onfocusin={handleWindowFocusIn} />

<nav
  aria-label={resolvedPaginationLabel}
  style={pgStyle}
  class="flex flex-wrap items-center gap-1.5 text-[length:var(--pg-font)] text-slate-400 {className}">
  <button
    type="button"
    aria-label={resolvedPreviousLabel}
    disabled={!canGoPrev}
    onclick={() => changePageBy(-1)}
    class={iconButtonClass}>
    <ChevronLeftIcon size={pgIconPx} />
  </button>

  {#if showStartEllipsis}
    <button type="button" onclick={() => goToPage(1)} class={pageButtonClass}>1</button>
    <span class={`inline-flex ${pageButtonBox} items-center justify-center font-semibold text-slate-500`}
      >…</span>
  {/if}

  {#each pageNumbers as pageNum (pageNum)}
    {#if pageNum === currentPage}
      <NumberInput
        bind:this={pageJumpInput}
        bind:value={pageJumpInputValue}
        {size}
        min={1}
        max={totalPages}
        inputStyle={pageInputStyle}
        onblur={handlePageInputBlur}
        onkeydown={handlePageInputKeydown}
        ariaLabel={resolvedCurrentPageLabel}
        showControls={false}
        className={`h-[var(--pg-btn)] min-w-[var(--pg-btn)] rounded-md border border-cyan-500 bg-slate-950 text-center text-[length:var(--pg-font)] font-semibold text-cyan-300 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-500/40`} />
    {:else}
      <button type="button" onclick={() => goToPage(pageNum)} class={pageButtonClass}>{pageNum}</button>
    {/if}
  {/each}

  {#if showEndEllipsis}
    <span class={`inline-flex ${pageButtonBox} items-center justify-center font-semibold text-slate-500`}
      >…</span>
    <button type="button" onclick={() => goToPage(totalPages)} class={pageButtonClass}>{totalPages}</button>
  {/if}

  <button
    type="button"
    aria-label={resolvedNextLabel}
    disabled={!canGoNext}
    onclick={() => changePageBy(1)}
    class={iconButtonClass}>
    <ChevronRightIcon size={pgIconPx} />
  </button>

  {#if onPageSizeChange}
    <div class="flex items-center gap-1.5">
      <span>{resolvedPageSizeLabel}</span>
      <div class="relative">
        <SelectDropdown
          buttonLabel={String(pageSize)}
          activeValue={String(pageSize)}
          ariaLabel={resolvedPageSizeLabel}
          {size}
          options={pageSizeOptions.map(option => ({ value: String(option), label: String(option) }))}
          onSelect={handlePageSizeChange}
          emptyLabel={i18n.t('dropdown.noOptions')} />
      </div>
    </div>
  {/if}
  {#if trailing}
    <span class="ml-auto">{@render trailing()}</span>
  {/if}
</nav>
