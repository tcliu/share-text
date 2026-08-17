<script lang="ts">
  import type { Snippet } from 'svelte'
  import { tick } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { page } from '$app/stores'
  import { goto, afterNavigate } from '$app/navigation'
  import type { LayoutData } from './$types'
  import { setShareTextContext } from '$lib/share-text-context'
  import DocumentList from '$lib/components/DocumentList.svelte'
  import Splitter from '$lib/components/Splitter.svelte'
  import Button from '$lib/components/Button.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import AdminIcon from '$lib/icons/AdminIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import ChevronsRightIcon from '$lib/icons/ChevronsRightIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import MobileDrawer from '$lib/components/MobileDrawer.svelte'
  import ProfileDialog from '$lib/components/ProfileDialog.svelte'
  import LanguageMenu from '$lib/components/LanguageMenu.svelte'
  import { t } from '$lib/i18n.svelte'
  import { useDocuments } from '$lib/use-documents.svelte'
  import { useEditorGuard } from '$lib/use-editor-guard.svelte'
  import { useUserAuth } from '$lib/use-user-auth.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import {
    loadSplitPaneWidth,
    saveSplitPaneWidth,
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
  const userAuthState = useUserAuth()

  let selectedDocumentRefreshToken = $state(0)
  let deleteTarget = $state<string | null>(null)
  let leftPaneCollapsed = $state(false)
  let leftPaneWidth = $state(loadSplitPaneWidth())
  let leftPaneMinWidth = $state(SPLIT_PANE_MIN_WIDTH)
  let editorFocus = $state<(() => void) | null>(null)
  let mobileDrawerOpen = $state(false)
  let profileOpen = $state(false)

  const selectedId = $derived($page.params.id ?? null)
  const showingEditor = $derived($page.params.id != null || $page.url.pathname === '/new')

  const profileIdentity = $derived(userAuthState.admin ?? userAuthState.user)
  const isAdminIdentity = $derived(userAuthState.admin !== null)

  let isMobile = $state(false)
  let mainRef = $state<HTMLElement | null>(null)

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
      closeMobileDrawer()
      await tick()
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

  async function toggleLeftPane() {
    leftPaneCollapsed = !leftPaneCollapsed
    await tick()
    editorFocus?.()
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

  async function handleSignOut() {
    await userAuthState.signOut()
    await documentsState.refreshList()
  }

  $effect(() => {
    void userAuthState.checkSession()
  })

  afterNavigate((navigation) => {
    closeMobileDrawer()
    if (navigation.type === 'enter') return
    const main = mainRef
    if (main && !main.contains(document.activeElement)) {
      main.focus()
    }
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
    updateDocumentSummary: documentsState.updateDocumentSummary,
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
    get user() {
      return userAuthState.user
    },
    get admin() {
      return userAuthState.admin
    },
    signOut: handleSignOut,
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
    onProfile={() => (profileOpen = true)}
    onAdmin={() => goto('/admin')}
    user={profileIdentity}
    isAdmin={isAdminIdentity}
    onSignOut={handleSignOut}
    onLoadMore={documentsState.loadMore}
    onToggleCollapse={handleListCollapse}
    onMinWidthChange={handleMinWidthChange} />
{/snippet}

<h1 class="sr-only">ShareText</h1>
<a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cyan-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950">Skip to content</a>

<div class="flex h-dvh overflow-hidden">
  {#if !isMobile && leftPaneCollapsed}
    <div class="flex w-11 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900/50 py-2">
      <Button size="sm" ariaLabel={t('list.showDocumentList')} tooltip={t('list.showDocumentList')} ariaExpanded={!leftPaneCollapsed} onClick={toggleLeftPane}>
        {#snippet icon()}
          <ChevronsRightIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel={t('list.newDocument')} tooltip={t('list.newDocument')} onClick={handleNew}>
        {#snippet icon()}
          <PlusIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={t('list.refresh')}
        tooltip={t('list.refresh')}
        onClick={handleRefresh}
        disabled={documentsState.loadingDocuments}>
        {#snippet icon()}
          <RefreshIcon />
        {/snippet}
      </Button>
      <LanguageMenu />
      {#if profileIdentity}
        {#if isAdminIdentity}
          <Button size="sm" ariaLabel={t('list.adminConsole')} tooltip={t('list.adminConsole')} onClick={() => goto('/admin')}>
            {#snippet icon()}
              <AdminIcon />
            {/snippet}
          </Button>
        {/if}
        <Button
          size="sm"
          ariaLabel={t('list.signOut')}
          tooltip={t('list.signedInAs', { name: profileIdentity.username })}
          onClick={() => void handleSignOut()}>
          {#snippet icon()}
            <SignOutIcon />
          {/snippet}
        </Button>
      {:else}
        <Button size="sm" ariaLabel={t('list.login')} tooltip={t('list.login')} onClick={() => goto('/login')}>
          {#snippet icon()}
            <PersonIcon />
          {/snippet}
        </Button>
      {/if}
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
    bind:this={mainRef}
    id="main-content"
    tabindex="-1"
    class={`min-w-0 flex-1 outline-none ${showingEditor ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
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
    title={t('discard.title')}
    message={t('discard.message')}
    confirmLabel={t('common.ok')}
    confirmColor="amber"
    onConfirm={handleConfirmDiscard}
    onCancel={editorGuardState.handleCancelDiscard} />
{/if}

{#if deleteTarget !== null}
  <ConfirmDialog
    title={t('delete.title')}
    message={t('delete.message')}
    confirmLabel={t('common.delete')}
    confirmColor="rose"
    onConfirm={confirmDelete}
    onCancel={() => (deleteTarget = null)} />
{/if}

{#if profileOpen && profileIdentity}
  <ProfileDialog user={profileIdentity} onClose={() => (profileOpen = false)} />
{/if}
