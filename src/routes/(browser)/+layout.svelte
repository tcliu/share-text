<script lang="ts">
  import type { Snippet } from 'svelte'
  import { tick } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { page } from '$app/stores'
  import { goto, afterNavigate } from '$app/navigation'
  import type { LayoutData } from './$types'
  import { setShareTextContext } from '$lib/share-text-context'
  import DocumentList from '$lib/components/DocumentList.svelte'
  import AppShell from '$lib/components/AppShell.svelte'
  import Button from '$lib/components/Button.svelte'
  import PersonIcon from '$lib/icons/PersonIcon.svelte'
  import SettingsIcon from '$lib/icons/SettingsIcon.svelte'
  import MenuIcon from '$lib/icons/MenuIcon.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import BaseDialog from '$lib/components/BaseDialog.svelte'
  import UserAuthPanel, { type AuthPanelMode } from '$lib/components/UserAuthPanel.svelte'
  import LanguageMenu from '$lib/components/LanguageMenu.svelte'
  import ThemeMenu from '$lib/components/ThemeMenu.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import { useDocuments } from '$lib/use-documents.svelte'
  import { useEditorGuard } from '$lib/use-editor-guard.svelte'
  import { useUserAuth } from '$lib/use-user-auth.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import {
    APP_SHELL_DEFAULT_WIDTH,
    APP_SHELL_MAX_WIDTH,
    APP_SHELL_MIN_WIDTH,
  } from '$lib/app-shell'

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
  let leftPaneOpen = $state(true)
  let leftPaneWidth = $state(APP_SHELL_DEFAULT_WIDTH)
  let leftPaneMinWidth = $state(APP_SHELL_MIN_WIDTH)
  // Mirrors the shell's own dock/floating presentation so the list's route
  // sync and close affordance use the shell's ruler, never a second breakpoint.
  let paneFloating = $state(false)
  let editorFocus = $state<(() => void) | null>(null)
  let loginOpen = $state(false)
  let loginMode: AuthPanelMode = $state('signin')

  const selectedId = $derived($page.params.id ?? null)
  const showingEditor = $derived($page.params.id != null || $page.url.pathname === '/new')

  const profileIdentity = $derived(userAuthState.admin ?? userAuthState.user)
  const isAdminIdentity = $derived(userAuthState.admin !== null)

  let isMobile = $state(false)
  let mainRef = $state<HTMLElement | null>(null)

  $effect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 1023px)')
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
      // Only the floating drawer overlaps the editor; a docked pane stays put.
      if (paneFloating) closeDrawer()
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

  // The AppShell header owns the collapse toggle on every viewport so a
  // closed pane can always be reopened; the list keeps its collapse button
  // only as a close affordance while the pane floats.
  const handleListCollapse = $derived.by(() => {
    if (!paneFloating || !leftPaneOpen) return undefined
    return closeDrawerAndFocus
  })

  function handleMinWidthChange(minWidth: number) {
    const effectiveMin = Math.min(APP_SHELL_MAX_WIDTH, Math.max(APP_SHELL_MIN_WIDTH, minWidth))
    leftPaneMinWidth = effectiveMin
    if (leftPaneWidth < effectiveMin) {
      leftPaneWidth = effectiveMin
    }
  }

  function openMobileDrawer() {
    leftPaneOpen = true
  }

  function closeDrawer() {
    leftPaneOpen = false
  }

  async function closeDrawerAndFocus() {
    leftPaneOpen = false
    await tick()
    if (showingEditor) {
      editorFocus?.()
    } else {
      mainRef?.focus()
    }
  }

  async function handleSignOut() {
    await userAuthState.signOut()
    await documentsState.refreshList()
  }

  async function handleLoginSuccess() {
    loginOpen = false
    await userAuthState.checkSession()
    await documentsState.refreshList()
  }

  function handleLoginAuthenticated(admin = false) {
    // Normal users stay on the browser page; an admin session belongs in the
    // console. The guard's beforeNavigate hook prompts on dirty editors.
    if (admin) {
      void goto('/admin/general')
    }
  }

  function handleSettings() {
    const url = isAdminIdentity ? '/admin' : '/settings'
    if (!editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'navigate', url })
      return
    }
    void goto(url)
  }

  function handleSignOutClick() {
    if (!editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'signOut' })
      return
    }
    void handleSignOut()
  }

  $effect(() => {
    void userAuthState.checkSession()
  })

  // /login redirects here with ?login=1: auto-open the dialog once, then
  // strip the param with replaceState so no navigation (and no dirty-editor
  // prompt) is involved.
  $effect(() => {
    if ($page.url.searchParams.get('login') === null) return
    loginOpen = true
    const url = new URL($page.url)
    url.searchParams.delete('login')
    history.replaceState(null, '', url.pathname + (url.search ? `?${url.searchParams}` : '') + url.hash)
  })

  // While the pane floats it is an overlay: keep it open on the list route and
  // closed on editor routes so the list never covers the editor, while a docked
  // pane's collapse state is left untouched. Keyed off the shell's own
  // presentation so the two rulers can never disagree.
  $effect(() => {
    if (paneFloating) {
      leftPaneOpen = !showingEditor
    }
  })

  afterNavigate(navigation => {
    if (navigation.type === 'enter') return
    const main = mainRef
    if (main && !main.contains(document.activeElement)) {
      main.focus()
    }
  })

  $effect(() => {
    if (editorGuardState.discardDialogOpen && paneFloating) {
      leftPaneOpen = false
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
    } else if (action.kind === 'signOut') {
      void handleSignOut()
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
    bare
    documents={documentsState.documents}
    loading={documentsState.loadingDocuments}
    error={documentsState.documentsError}
    {selectedId}
    hasMore={documentsState.hasMore}
    bind:searchInput={documentsState.searchInput}
    searchActive={documentsState.searchInput.trim() !== '' || documentsState.searchQuery !== ''}
    onSearchInput={documentsState.handleSearchInput}
    onSearchKeydown={documentsState.handleSearchKeydown}
    onNew={handleNew}
    onRefresh={handleRefresh}
    onLoadMore={documentsState.loadMore}
    onToggleCollapse={handleListCollapse}
    onMinWidthChange={handleMinWidthChange} />
{/snippet}

{#snippet browserHeader(api: import('$lib/app-shell').AppShellHeaderApi)}
  <div class="flex items-center gap-2">
    <!-- -ml-1 puts the button box flush with the document search box below (header px-3 vs pane px-2). -->
    <Button
      size="sm"
      className="-ml-1"
      ariaLabel={api.open ? i18n.t('list.collapse') : i18n.t('list.showDocumentList')}
      tooltip={api.open ? i18n.t('list.collapse') : i18n.t('list.showDocumentList')}
      ariaExpanded={api.open}
      preventFocusSteal
      onClick={() => api.toggleLeft()}>
      {#snippet icon()}
        <MenuIcon className="h-4 w-4" />
      {/snippet}
    </Button>
    <h1 class="text-base font-semibold tracking-tight whitespace-nowrap text-slate-200 sm:text-lg">
      {i18n.t('app.name')}
    </h1>
  </div>
  <div class="flex items-center gap-2">
    <ThemeMenu align="right" />
    <LanguageMenu align="right" />
    {#if profileIdentity}
      <Button
        size="sm"
        ariaLabel={i18n.t('list.settings')}
        tooltip={i18n.t('list.settingsWith', { name: profileIdentity.username })}
        onClick={handleSettings}>
        {#snippet icon()}
          <SettingsIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={i18n.t('list.signOut')}
        tooltip={i18n.t('list.signedInAs', { name: profileIdentity.username })}
        onClick={handleSignOutClick}>
        {#snippet icon()}
          <SignOutIcon />
        {/snippet}
      </Button>
    {:else}
      <Button
        size="sm"
        ariaLabel={i18n.t('list.login')}
        tooltip={i18n.t('list.login')}
        onClick={() => (loginOpen = true)}>
        {#snippet icon()}
          <PersonIcon />
        {/snippet}
      </Button>
    {/if}
  </div>
{/snippet}

<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-cyan-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
  >Skip to content</a>

<AppShell
  bind:open={leftPaneOpen}
  bind:paneSize={leftPaneWidth}
  min={leftPaneMinWidth}
  max={APP_SHELL_MAX_WIDTH}
  defaultSize={APP_SHELL_DEFAULT_WIDTH}
  storageKey="share-text:split-pane-width"
  headerClassName="flex-wrap"
  leftPaneLabel={i18n.t('editor.documentList')}
  onLayoutModeChange={floating => (paneFloating = floating)}
  onOpenChange={() => {
    if (!paneFloating) void tick().then(() => editorFocus?.())
  }}
  header={browserHeader}>
  {#snippet leftPane()}
    {@render documentList()}
  {/snippet}
  <div bind:this={mainRef} id="main-content" tabindex="-1" class="flex min-h-full flex-1 flex-col outline-none">
    {@render children()}
  </div>
</AppShell>

{#if editorGuardState.discardDialogOpen}
  <ConfirmDialog
    title={i18n.t('discard.title')}
    message={i18n.t('discard.message')}
    confirmLabel={i18n.t('common.ok')}
    confirmColor="amber"
    onConfirm={handleConfirmDiscard}
    confirmOnDismiss />
{/if}

{#if deleteTarget !== null}
  <ConfirmDialog
    title={i18n.t('delete.title')}
    message={i18n.t('delete.message')}
    confirmLabel={i18n.t('common.delete')}
    confirmColor="rose"
    onConfirm={confirmDelete}
    onCancel={() => (deleteTarget = null)} />
{/if}

{#if loginOpen}
  <BaseDialog
    title={loginMode === 'signin' ? i18n.t('auth.login') : i18n.t('auth.createAccount')}
    maxWidth="md"
    onCancel={() => (loginOpen = false)}>
    <UserAuthPanel
      embedded
      bind:mode={loginMode}
      onAuthenticated={handleLoginAuthenticated}
      onsuccess={() => void handleLoginSuccess()} />
  </BaseDialog>
{/if}
