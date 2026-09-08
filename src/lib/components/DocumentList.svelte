<script lang="ts">
  import type { OwnedDocumentSummary, ProfileIdentity } from '$lib/documents'
  import { measureHeaderMinWidth } from '$lib/document-list-helpers'
  import Button from './Button.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import SettingsIcon from '$lib/icons/SettingsIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import ChevronsLeftIcon from '$lib/icons/ChevronsLeftIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import LockIcon from '$lib/icons/LockIcon.svelte'
  import SearchInput from './SearchInput.svelte'
  import Chip from './Chip.svelte'
  import LanguageMenu from './LanguageMenu.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
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
    onSettings?: () => void
    onSignOut?: () => void
    user?: ProfileIdentity | null
    onLoadMore: () => void
    onToggleCollapse?: () => void
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
    onSettings,
    onSignOut,
    user = null,
    onLoadMore,
    onToggleCollapse,
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
  aria-label={i18n.t('editor.documentList')}
  class="flex h-full w-full shrink-0 flex-col gap-2 border-r border-slate-800 bg-slate-900/50 md:w-[var(--aside-w,100%)]"
  style={width !== undefined ? `--aside-w: ${width}px` : undefined}>
  <div bind:this={headerRef} class="flex items-center justify-between px-2 pt-2">
    <div class="flex items-center gap-1">
      <span class="p-1 text-md font-semibold text-slate-200">{i18n.t('app.name')}</span>
    </div>
    <div class="flex items-center gap-1">
      {#if onToggleCollapse}
        <Button
          size="sm"
          ariaLabel={i18n.t('list.collapse')}
          tooltip={i18n.t('list.collapse')}
          ariaExpanded={true}
          preventFocusSteal
          onClick={onToggleCollapse}>
          {#snippet icon()}
            <ChevronsLeftIcon />
          {/snippet}
        </Button>
      {/if}
      <Button size="sm" ariaLabel={i18n.t('list.newDocument')} tooltip={i18n.t('list.newDocument')} onClick={onNew}>
        {#snippet icon()}
          <PlusIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel={i18n.t('list.refresh')} tooltip={i18n.t('list.refresh')} onClick={onRefresh} disabled={loading}>
        {#snippet icon()}
          <RefreshIcon />
        {/snippet}
      </Button>
      {#if user}
        <LanguageMenu />
        <Button
          size="sm"
          ariaLabel={i18n.t('list.settings')}
          tooltip={i18n.t('list.settingsWith', { name: user.username })}
          onClick={onSettings}>
          {#snippet icon()}
            <SettingsIcon />
          {/snippet}
        </Button>
        <Button size="sm" ariaLabel={i18n.t('list.signOut')} tooltip={i18n.t('list.signOut')} onClick={onSignOut}>
          {#snippet icon()}
            <SignOutIcon />
          {/snippet}
        </Button>
      {:else}
        <LanguageMenu />
        <Button size="sm" ariaLabel={i18n.t('list.login')} tooltip={i18n.t('list.login')} onClick={onLogin}>
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
    ariaLabel={i18n.t('list.searchDocuments')}
    placeholder={i18n.t('list.searchDocumentsPlaceholder')}
    wrapperClass="px-2" />

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
    {#if loading && documents.length === 0}
      <p class="p-2 text-sm text-slate-400">{i18n.t('list.loadingDocuments')}</p>
    {:else if documents.length === 0}
      <p class="p-2 text-sm text-slate-400">
        {searchActive ? i18n.t('list.noMatches') : i18n.t('list.empty')}
      </p>
    {:else}
      <div class="flex flex-col">
        {#each documents as document (document.id)}
          <a
            href={`/${document.id}`}
            aria-current={document.id === selectedId ? 'true' : undefined}
            class={`group flex w-full items-start gap-2 rounded-md p-2 text-sm text-slate-300 outline-none transition ${document.id === selectedId ? 'bg-slate-800/70 text-slate-100' : 'hover:bg-slate-800/40 hover:text-slate-100 focus:bg-slate-800/40 focus:text-slate-100'}`}>
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span class="min-w-0 truncate">{document.name}</span>
              {#if document.documentType !== 'text'}
                <Chip
                  label={getDocumentType(document.documentType).label}
                  chipClass={tagChipClass()}
                  style={tagChipStyle(getDocumentType(document.documentType).chipColor)} />
              {/if}
              {#if document.isPublic === false}
                <span
                  class={tagChipClass()}
                  style="color: #94a3b8; border-color: rgba(148,163,184,0.4); background-color: rgba(148,163,184,0.1);">
                  <LockIcon className="h-3 w-3" />
                  {i18n.t('list.private')}
                </span>
              {/if}
            </div>
          </a>
        {/each}
        {#if hasMore}
          <div
            bind:this={loadMoreSentinel}
            class="flex min-h-10 items-center justify-center py-2 text-sm text-slate-400">
            {loading ? i18n.t('list.loadingMore') : ''}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <p class="border-t border-slate-800 px-4 py-2 text-sm text-rose-300">{error}</p>
  {/if}
</aside>
