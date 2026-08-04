<script lang="ts">
  import NumberInput from './NumberInput.svelte'
  import SelectDropdown from './SelectDropdown.svelte'

  interface Props {
    total: number
    pageSize: number
    currentPage: number
    size?: 'xs' | 'sm' | 'md' | 'lg'
    pageSizeOptions?: number[]
    onPageChange: (page: number) => void
    onPageSizeChange: (size: number) => void
  }

  let {
    total,
    pageSize,
    currentPage,
    size = 'sm',
    pageSizeOptions = [10, 20, 50],
    onPageChange,
    onPageSizeChange,
  }: Props = $props()

  const PAGE_JUMP_DELTA = 2

  const SIZE_CLASS = {
    xs: {
      iconButton: 'h-8 w-8',
      pageButton: 'h-8 min-w-8 px-2',
      pageInput: 'flex-none h-8 w-8 p-0',
      text: 'text-xs',
      icon: 'h-4 w-4',
      pad: 'py-1',
    },
    sm: {
      iconButton: 'h-9 w-9',
      pageButton: 'h-9 min-w-9 px-2.5',
      pageInput: 'flex-none h-9 w-9 p-0',
      text: 'text-sm',
      icon: 'h-4 w-4',
      pad: 'py-2',
    },
    md: {
      iconButton: 'h-10 w-10',
      pageButton: 'h-10 min-w-10 px-3',
      pageInput: 'flex-none h-10 w-10 p-0',
      text: 'text-md',
      icon: 'h-5 w-5',
      pad: 'py-2.5',
    },
    lg: {
      iconButton: 'h-11 w-11',
      pageButton: 'h-11 min-w-11 px-3.5',
      pageInput: 'flex-none h-11 w-11 p-0',
      text: 'text-lg',
      icon: 'h-5 w-5',
      pad: 'py-3',
    },
  } as const

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)))
  const canGoPrev = $derived(currentPage > 1)
  const canGoNext = $derived(currentPage < totalPages)

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

  const iconButtonClass = $derived(
    `relative inline-flex ${SIZE_CLASS[size].iconButton} items-center justify-center rounded-md border border-slate-700 bg-slate-950 font-semibold text-slate-100 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40`,
  )

  const pageButtonClass = $derived(
    `relative inline-flex ${SIZE_CLASS[size].pageButton} items-center justify-center rounded-md border border-slate-700 bg-slate-950 font-semibold text-slate-100 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40`,
  )

  let pageJumpInputValue = $state('')

  $effect(() => {
    pageJumpInputValue = String(currentPage)
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

  function clampPageInput() {
    const parsed = Number.parseInt(pageJumpInputValue, 10)
    if (Number.isNaN(parsed)) {
      pageJumpInputValue = String(currentPage)
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), totalPages)
    if (clamped === currentPage) {
      pageJumpInputValue = String(currentPage)
      return
    }
    onPageChange(clamped)
  }

  function handlePageInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      clampPageInput()
    } else if (event.key === 'Escape') {
      pageJumpInputValue = String(currentPage)
    }
  }

  function handlePageSizeChange(value: string) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0 && parsed !== pageSize) {
      onPageSizeChange(parsed)
    }
  }
</script>

<div class="flex flex-wrap items-center gap-1.5 {SIZE_CLASS[size].text} text-slate-400">
  <button
    type="button"
    aria-label="Previous page"
    disabled={!canGoPrev}
    onclick={() => changePageBy(-1)}
    class={iconButtonClass}>
    <svg class={`${SIZE_CLASS[size].icon}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M11.78 4.22a.75.75 0 0 1 0 1.06L7.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
        clip-rule="evenodd" />
    </svg>
  </button>

  {#if showStartEllipsis}
    <button type="button" onclick={() => goToPage(1)} class={pageButtonClass}>1</button>
    <span class={`inline-flex ${SIZE_CLASS[size].pageButton} items-center justify-center font-semibold text-slate-500`}>…</span>
  {/if}

  {#each pageNumbers as pageNum}
    {#if pageNum === currentPage}
      <NumberInput
        bind:value={pageJumpInputValue}
        min={1}
        max={totalPages}
        onblur={clampPageInput}
        onkeydown={handlePageInputKeydown}
        ariaLabel="Current page"
        showControls={false}
        className={`inline-flex ${SIZE_CLASS[size].pageInput} items-center justify-center rounded-md border border-cyan-500 bg-slate-950 text-center ${SIZE_CLASS[size].text} font-semibold text-cyan-300 outline-none focus:border-2`} />
    {:else}
      <button type="button" onclick={() => goToPage(pageNum)} class={pageButtonClass}>{pageNum}</button>
    {/if}
  {/each}

  {#if showEndEllipsis}
    <span class={`inline-flex ${SIZE_CLASS[size].pageButton} items-center justify-center font-semibold text-slate-500`}>…</span>
    <button type="button" onclick={() => goToPage(totalPages)} class={pageButtonClass}>{totalPages}</button>
  {/if}

  <button
    type="button"
    aria-label="Next page"
    disabled={!canGoNext}
    onclick={() => changePageBy(1)}
    class={iconButtonClass}>
    <svg class={`${SIZE_CLASS[size].icon}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M8.22 15.78a.75.75 0 0 1 0-1.06L12.94 10 8.22 5.28a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0Z"
        clip-rule="evenodd" />
    </svg>
  </button>

  <div class="flex items-center gap-1.5">
    <span>Page size</span>
    <div class="relative">
      <SelectDropdown
        buttonLabel={String(pageSize)}
        activeValue={String(pageSize)}
        ariaLabel="Page size"
        size={size}
        options={pageSizeOptions.map(size => ({ value: String(size), label: String(size) }))}
        onSelect={handlePageSizeChange} />
    </div>
  </div>
</div>
