<script lang="ts">
  import type { Snippet } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { page } from '$app/stores'
  import { goto, afterNavigate } from '$app/navigation'
  import type { LayoutData } from './$types'
  import { setShareTextContext } from '$lib/share-text-context'
  import DocumentList from '$lib/components/DocumentList.svelte'
  import Splitter from '$lib/components/Splitter.svelte'
  import Button from '$lib/components/Button.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import ChevronsRightIcon from '$lib/icons/ChevronsRightIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import MobileDrawer from '$lib/components/MobileDrawer.svelte'
  import { useDocuments } from '$lib/use-documents.svelte'
  import { useEditorGuard } from '$lib/use-editor-guard.svelte'
  import {
    loadSplitPaneWidth,
    saveSplitPaneWidth,
    SPLIT_PANE_DEFAULT_WIDTH,
    SPLIT_PANE_MAX_WIDTH,
    SPLIT_PANE_MIN_WIDTH,
  } from '$lib/split-pane'

  let { children, data }: { children: Snippet; data?: LayoutData } = $props()

  // svelte-ignore state_referenced_locally
  const documentsState = useDocuments({
    initialDocuments: data?.documents,
    initialHasMore: data?.hasMore,
  })
  const editorGuardState = useEditorGuard()

  let selectedDocumentRefreshToken = $state(0)
  let deleteTarget = $state<string | null>(null)
  let leftPaneCollapsed = $state(false)
  let leftPaneWidth = $state(SPLIT_PANE_DEFAULT_WIDTH)
  let leftPaneMinWidth = $state(SPLIT_PANE_MIN_WIDTH)
  let editorFocus = $state<(() => void) | null>(null)
  let mobileDrawerOpen = $state(false)

  $effect(() => {
    leftPaneWidth = loadSplitPaneWidth()
  })

  const selectedId = $derived($page.params.id ?? null)
  const showingEditor = $derived($page.params.id != null || $page.url.pathname === '/new')

  let isMobile = $state(false)

  $effect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => (isMobile = media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  })

  function requestSelectedDocumentRefresh() {
    selectedDocumentRefreshToken += 1
  }

  async function handleNew() {
    if (!editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'new' })
      return
    }
    if ($page.url.pathname === '/new') {
      editorFocus?.()
      return
    }
    await documentsState.performCreate()
  }

  async function handleRefresh() {
    if (!editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'refresh' })
      return
    }
    await documentsState.refreshList()
    requestSelectedDocumentRefresh()
  }

  function handleDelete(id: string) {
    const currentId = editorGuardState.editorGuard?.getCurrentDocumentId() ?? null
    if (currentId === id && !editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'delete', id })
      return
    }
    deleteTarget = id
  }

  async function confirmDelete() {
    const id = deleteTarget
    deleteTarget = null
    if (!id) return

    const success = await documentsState.performDelete(id)
    if (success) {
      if (editorGuardState.editorGuard?.getCurrentDocumentId() === id) {
        await goto('/')
      }
    }
  }

  function toggleLeftPane() {
    leftPaneCollapsed = !leftPaneCollapsed
  }

  const handleListCollapse = $derived.by(() => {
    if (!isMobile) return toggleLeftPane
    return mobileDrawerOpen ? closeMobileDrawer : undefined
  })

  function handleSplitPaneChange(value: number) {
    leftPaneWidth = value
  }

  function handleSplitPaneDragEnd() {
    saveSplitPaneWidth(leftPaneWidth)
  }

  function handleMinWidthChange(minWidth: number) {
    const effectiveMin = Math.min(SPLIT_PANE_MAX_WIDTH, Math.max(SPLIT_PANE_MIN_WIDTH, minWidth))
    leftPaneMinWidth = effectiveMin
    if (leftPaneWidth < effectiveMin) {
      leftPaneWidth = effectiveMin
    }
  }

  function openMobileDrawer() {
    mobileDrawerOpen = true
  }

  function closeMobileDrawer() {
    mobileDrawerOpen = false
  }

  afterNavigate(() => {
    closeMobileDrawer()
  })

  $effect(() => {
    if (editorGuardState.discardDialogOpen) {
      closeMobileDrawer()
    }
  })

  function handleConfirmDiscard() {
    const action = editorGuardState.handleConfirmDiscard()
    if (!action) return

    if (action.kind === 'new') {
      handleNew()
    } else if (action.kind === 'refresh') {
      handleRefresh()
    } else if (action.kind === 'delete') {
      deleteTarget = action.id
    }
  }

  setShareTextContext({
    get documents() {
      return documentsState.documents
    },
    get loadingDocuments() {
      return documentsState.loadingDocuments
    },
    get documentsError() {
      return documentsState.documentsError
    },
    createDocument: handleNew,
    deleteDocument: handleDelete,
    refreshList: documentsState.refreshList,
    get selectedDocumentRefreshToken() {
      return selectedDocumentRefreshToken
    },
    requestSelectedDocumentRefresh,
    registerEditorGuard: editorGuardState.registerEditorGuard,
    unregisterEditorGuard: editorGuardState.unregisterEditorGuard,
    canLeaveCurrentDocument: editorGuardState.canLeaveCurrentDocument,
    registerEditorFocus: (focus: () => void) => {
      editorFocus = focus
    },
    unregisterEditorFocus: () => {
      editorFocus = null
    },
    openMobileDrawer,
    get isMobile() {
      return isMobile
    },
  })

  $effect(() => {
    if (data?.documents === undefined) {
      void documentsState.refreshList()
    }
  })
</script>

{#snippet documentList()}
  <DocumentList
    documents={documentsState.documents}
    loading={documentsState.loadingDocuments}
    error={documentsState.documentsError}
    {selectedId}
    hasMore={documentsState.hasMore}
    bind:searchInput={documentsState.searchInput}
    searchActive={documentsState.searchInput.trim() !== '' || documentsState.searchQuery !== ''}
    onSearchInput={documentsState.handleSearchInput}
    onSearchKeydown={documentsState.handleSearchKeydown}
    width={isMobile ? undefined : leftPaneWidth}
    onNew={handleNew}
    onRefresh={handleRefresh}
    onLogin={() => goto('/login')}
    onDelete={handleDelete}
    onLoadMore={documentsState.loadMore}
    onToggleCollapse={handleListCollapse}
    onMinWidthChange={handleMinWidthChange}
    deletePending={deleteTarget !== null} />
{/snippet}

<div class="flex h-dvh overflow-hidden">
  {#if !isMobile && leftPaneCollapsed}
    <div class="flex w-11 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900/50 py-2">
      <Button size="sm" ariaLabel="Show document list" tooltip="Show document list" onClick={toggleLeftPane}>
        {#snippet icon()}
          <ChevronsRightIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="New document" tooltip="New document" onClick={handleNew}>
        {#snippet icon()}
          <PlusIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Refresh"
        tooltip="Refresh"
        onClick={handleRefresh}
        disabled={documentsState.loadingDocuments}>
        {#snippet icon()}
          <RefreshIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Login" tooltip="Login" onClick={() => goto('/login')}>
        {#snippet icon()}
          <PersonIcon />
        {/snippet}
      </Button>
    </div>
  {:else if !isMobile || !showingEditor}
    <div class={`flex ${showingEditor ? 'hidden md:flex' : 'w-full md:w-auto'}`}>
      {@render documentList()}
      {#if !isMobile}
        <Splitter
          className="hidden md:block"
          value={leftPaneWidth}
          min={leftPaneMinWidth}
          max={SPLIT_PANE_MAX_WIDTH}
          onChange={handleSplitPaneChange}
          onDragEnd={handleSplitPaneDragEnd} />
      {/if}
    </div>
  {/if}
  <main
    class={`min-w-0 flex-1 ${showingEditor ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
    {@render children()}
  </main>
</div>

{#if isMobile && showingEditor}
  <MobileDrawer open={mobileDrawerOpen} onClose={closeMobileDrawer}>
    {@render documentList()}
  </MobileDrawer>
{/if}

{#if editorGuardState.discardDialogOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="This document has unsaved changes that will be lost."
    confirmLabel="OK"
    confirmColor="amber"
    onConfirm={handleConfirmDiscard}
    onCancel={editorGuardState.handleCancelDiscard} />
{/if}

{#if deleteTarget !== null}
  <ConfirmDialog
    title="Delete document?"
    message="This document will be permanently deleted."
    confirmLabel="Delete"
    confirmColor="rose"
    onConfirm={confirmDelete}
    onCancel={() => (deleteTarget = null)} />
{/if}
