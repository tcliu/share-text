<script lang="ts">
  import { goto } from '$app/navigation'
  import type { OwnedDocumentSummary, User } from '$lib/documents'
  import { measureHeaderMinWidth } from '$lib/document-list-helpers'
  import Copyable from './Copyable.svelte'
  import Button from './Button.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import ChevronsLeftIcon from '$lib/icons/ChevronsLeftIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import SearchInput from './SearchInput.svelte'
  import Chip from './Chip.svelte'
  import { getDocumentType } from '$lib/document-types'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'

  interface Props {
    documents: OwnedDocumentSummary[]
    loading: boolean
    error: string | null
    selectedId: string | null
    hasMore: boolean
    searchInput?: string
    searchActive?: boolean
    onSearchInput?: (event: Event) => void
    onSearchKeydown?: (event: KeyboardEvent) => void
    onNew: () => void
    onRefresh: () => void
    onLogin: () => void
    onSignOut?: () => void
    user?: User | null
    onDelete: (id: string) => void
    onLoadMore: () => void
    onToggleCollapse?: () => void
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
    searchInput = $bindable(''),
    searchActive = false,
    onSearchInput,
    onSearchKeydown,
    onNew,
    onRefresh,
    onLogin,
    onSignOut,
    user = null,
    onDelete,
    onLoadMore,
    onToggleCollapse,
    deletePending,
    width,
    onMinWidthChange,
  }: Props = $props()

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
    if (!sentinel || loading || !hasMore) return

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
  class="flex h-full w-full shrink-0 flex-col gap-2 border-r border-slate-800 bg-slate-900/50"
  style={width !== undefined ? `width: ${width}px` : undefined}>
  <div bind:this={headerRef} class="flex items-center justify-between px-2 pt-2">
    <div class="flex items-center gap-1">
      <span class="p-1 text-md font-semibold text-slate-200">ShareText</span>
    </div>
    <div class="flex items-center gap-1">
      {#if onToggleCollapse}
        <Button
          size="sm"
          ariaLabel="Collapse document list"
          tooltip="Collapse document list"
          onClick={onToggleCollapse}>
          {#snippet icon()}
            <ChevronsLeftIcon />
          {/snippet}
        </Button>
      {/if}
      <Button size="sm" ariaLabel="New document" tooltip="New document" onClick={onNew}>
        {#snippet icon()}
          <PlusIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Refresh" tooltip="Refresh" onClick={onRefresh} disabled={loading}>
        {#snippet icon()}
          <RefreshIcon />
        {/snippet}
      </Button>
      {#if user}
        <span class="max-w-24 truncate px-1 text-xs text-slate-400" title={user.username}>{user.username}</span>
        <Button size="sm" ariaLabel="Sign out" tooltip="Sign out" onClick={onSignOut}>
          {#snippet icon()}
            <SignOutIcon />
          {/snippet}
        </Button>
      {:else}
        <Button size="sm" ariaLabel="Login" tooltip="Login" onClick={onLogin}>
          {#snippet icon()}
            <PersonIcon />
          {/snippet}
        </Button>
      {/if}
    </div>
  </div>

  <SearchInput
    bind:value={searchInput}
    oninput={onSearchInput}
    onkeydown={onSearchKeydown}
    ariaLabel="Search documents"
    placeholder="Search documents..."
    wrapperClass="px-2" />

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
    {#if loading && documents.length === 0}
      <p class="p-2 text-sm text-slate-500">Loading documents...</p>
    {:else if documents.length === 0}
      <p class="p-2 text-sm text-slate-500">
        {searchActive ? 'No documents match your search.' : 'No documents yet. Use New to create one.'}
      </p>
    {:else}
      <div class="flex flex-col">
        {#each documents as document (document.id)}
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
            {#if document.owned}
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
                    <DeleteIcon />
                  {/snippet}
                </Button>
              </span>
            {/if}
          </div>
        {/each}
        {#if hasMore}
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
