<script lang="ts">
  import { goto } from '$app/navigation'
  import type { DocumentSummary } from '$lib/documents'
  import { measureHeaderMinWidth } from '$lib/document-list-helpers'
  import Copyable from './Copyable.svelte'
  import Button from './Button.svelte'
  import SearchInput from './SearchInput.svelte'
  import Chip from './Chip.svelte'
  import { getDocumentType } from '$lib/document-types'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'

  interface Props {
    documents: DocumentSummary[]
    loading: boolean
    error: string | null
    selectedId: string | null
    hasMore: boolean
    onNew: () => void
    onRefresh: () => void
    onDelete: (id: string) => void
    onLoadMore: () => void
    onToggleCollapse: () => void
    onOpenAdmin: () => void
    deletePending: boolean
    width?: number
    onMinWidthChange?: (minWidth: number) => void
  }

  let {
    documents,
    loading,
    error,
    selectedId,
    hasMore,
    onNew,
    onRefresh,
    onDelete,
    onLoadMore,
    onToggleCollapse,
    onOpenAdmin,
    deletePending,
    width,
    onMinWidthChange,
  }: Props = $props()

  let searchQuery = $state('')

  const normalizedQuery = $derived(searchQuery.trim().toLowerCase())
  const visibleDocuments = $derived(
    normalizedQuery ? documents.filter(document => document.name.toLowerCase().includes(normalizedQuery)) : documents,
  )

  let loadMoreSentinel = $state<HTMLElement | null>(null)
  let headerRef = $state<HTMLElement | null>(null)

  // Captured into a plain let so the measurement effect is not re-triggered by
  // the parent re-creating this callback on every splitter drag frame.
  // svelte-ignore state_referenced_locally
  let minWidthChangeCallback = onMinWidthChange

  $effect(() => {
    const header = headerRef
    if (!header) return
    const reportMinWidth = () => {
      const minWidth = measureHeaderMinWidth(header)
      if (minWidth > 0) {
        minWidthChangeCallback?.(minWidth)
      }
    }
    if (typeof ResizeObserver === 'undefined') {
      reportMinWidth()
      return
    }
    const observer = new ResizeObserver(reportMinWidth)
    observer.observe(header)
    reportMinWidth()
    return () => observer.disconnect()
  })

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      searchQuery = ''
    }
  }

  function handleRowClick(id: string) {
    const url = new URL(window.location.href)
    url.pathname = `/${id}`
    goto(url)
  }

  function handleRowKeydown(event: KeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRowClick(id)
    }
  }

  function handleDeleteClick(event: MouseEvent, id: string) {
    event.stopPropagation()
    onDelete(id)
  }

  function handleDeleteKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation()
    }
  }

  $effect(() => {
    const sentinel = loadMoreSentinel
    if (!sentinel || loading || !hasMore || normalizedQuery) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  })
</script>

<aside
  class="flex h-full shrink-0 flex-col gap-2 border-r border-slate-800 bg-slate-900/50"
  style={width !== undefined ? `width: ${width}px` : undefined}>
  <div bind:this={headerRef} class="flex items-center justify-between px-2 pt-2">
    <div class="flex items-center gap-1">
      <span class="p-1 text-md font-semibold text-slate-200">ShareDoc</span>
    </div>
    <div class="flex items-center gap-1">
      <Button size="sm" ariaLabel="Collapse document list" tooltip="Collapse document list" onClick={onToggleCollapse}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clip-rule="evenodd" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="New document" tooltip="New document" onClick={onNew}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z"
              clip-rule="evenodd" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Refresh" tooltip="Refresh" onClick={onRefresh} disabled={loading}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Admin settings" tooltip="Admin settings" onClick={onOpenAdmin}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              clip-rule="evenodd" />
          </svg>
        {/snippet}
      </Button>
    </div>
  </div>

  <SearchInput
    bind:value={searchQuery}
    onkeydown={handleSearchKeydown}
    ariaLabel="Search documents"
    placeholder="Search documents..."
    wrapperClass="px-2" />

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
    {#if loading && documents.length === 0}
      <p class="p-2 text-sm text-slate-500">Loading documents...</p>
    {:else if visibleDocuments.length === 0}
      <p class="p-2 text-sm text-slate-500">
        {documents.length === 0 ? 'No documents yet. Use New to create one.' : 'No documents match your filter.'}
      </p>
    {:else}
      <div class="flex flex-col">
        {#each visibleDocuments as document (document.id)}
          <div
            class={`group flex cursor-pointer items-start gap-2 rounded-md p-2 transition ${document.id === selectedId ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'}`}
            role="button"
            tabindex="0"
            onclick={() => handleRowClick(document.id)}
            onkeydown={event => handleRowKeydown(event, document.id)}>
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Copyable
                text={document.name}
                className="text-sm text-slate-300"
                copyAriaLabel={`Copy document name ${document.name}`} />
              {#if document.documentType !== 'text'}
                <Chip
                  label={getDocumentType(document.documentType).label}
                  chipClass={tagChipClass()}
                  style={tagChipStyle(getDocumentType(document.documentType).chipColor)} />
              {/if}
            </div>
            <span class="flex shrink-0">
              <Button
                size="sm"
                ariaLabel="Delete document"
                tooltip="Delete"
                tooltipAlign="right"
                onClick={event => handleDeleteClick(event, document.id)}
                onKeyDown={handleDeleteKeydown}
                className="text-slate-400 hover:border-rose-500 hover:text-rose-300">
                {#snippet icon()}
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fill-rule="evenodd"
                      d="M8.75 2.75a1.75 1.75 0 0 0-1.67 1.23L6.89 4.5H4.5a.75.75 0 0 0 0 1.5h.44l.83 9.12A2.25 2.25 0 0 0 8.01 17.25h3.98a2.25 2.25 0 0 0 2.24-2.13l.83-9.12h.44a.75.75 0 0 0 0-1.5h-2.39l-.19-.52a1.75 1.75 0 0 0-1.67-1.23h-2.5Z"
                      clip-rule="evenodd" />
                  </svg>
                {/snippet}
              </Button>
            </span>
          </div>
        {/each}
        {#if hasMore && !normalizedQuery}
          <div
            bind:this={loadMoreSentinel}
            class="flex min-h-10 items-center justify-center py-2 text-sm text-slate-500">
            {loading ? 'Loading more...' : ''}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <p class="border-t border-slate-800 px-4 py-2 text-sm text-rose-300">{error}</p>
  {/if}
</aside>
