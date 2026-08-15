<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { page } from '$app/state'
  import { beforeNavigate, goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import DocumentIcon from '$lib/icons/DocumentIcon.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import Tabs, { type Tab } from '$lib/components/Tabs.svelte'
  import AdminPropertiesView from '$lib/components/AdminPropertiesView.svelte'
  import AdminDocumentsView from '$lib/components/AdminDocumentsView.svelte'
  import AdminUsersView from '$lib/components/AdminUsersView.svelte'
  import { useAdminAuth } from '$lib/use-admin-auth.svelte'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import { useAdminUsers } from '$lib/use-admin-users.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'
  import ExportIcon from '$lib/icons/ExportIcon.svelte'

  const PROPERTIES_PATH = '/admin/properties'
  const DOCUMENTS_PATH = '/admin/documents'
  const USERS_PATH = '/admin/users'
  type AdminState = {
    settingsState: ReturnType<typeof useAdminSettings>
    documentsState: ReturnType<typeof useAdminDocuments>
    usersState: ReturnType<typeof useAdminUsers>
  }

  let { children }: { children?: Snippet } = $props()

  let discardPromptOpen = $state(false)
  let pendingNavigateUrl = $state<string | null>(null)

  const settingsState = useAdminSettings(() => authState.handleSignedOut())
  const documentsState = useAdminDocuments({ onSignedOut: () => authState.handleSignedOut() })
  const usersState = useAdminUsers({ onSignedOut: () => authState.handleSignedOut() })
  const authState = useAdminAuth({
    onSignedOut() {
      settingsState.reset()
      documentsState.reset()
      usersState.reset()
    },
  })

  $effect(() => {
    if (authState.state === 'authenticated') {
      void settingsState.reload()
    }
  })

  $effect(() => {
    if (authState.state !== 'authenticated') return
    if (page.url.pathname === DOCUMENTS_PATH && !documentsState.loaded) {
      void documentsState.load()
    }
  })

  $effect(() => {
    if (authState.state !== 'authenticated') return
    if (page.url.pathname === USERS_PATH && !usersState.loaded) {
      void usersState.load()
    }
  })

  function handleDiscardAndNavigate() {
    const url = pendingNavigateUrl
    pendingNavigateUrl = null
    discardPromptOpen = false
    if (!url) return
    settingsState.resetDraft()
    void goto(url)
  }

  function handleCancelDiscard() {
    pendingNavigateUrl = null
    discardPromptOpen = false
  }

  beforeNavigate(navigation => {
    if (!settingsState.hasUnsavedChanges) return
    const url = navigation.to?.url
    if (!url) return
    // Tab switches within /admin share this layout's state, so the settings
    // draft survives and must not prompt to discard changes.
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return
    }
    navigation.cancel()
    pendingNavigateUrl = url.pathname + url.search
    discardPromptOpen = true
  })

  onMount(() => {
    void authState.checkSession()
  })
</script>

<svelte:head>
  <title>Admin</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  {#if authState.state === 'authenticated'}
    <header class="flex flex-none items-center justify-between border-b border-slate-800 px-4 py-2">
      <h1 class="text-md font-semibold text-slate-200">Admin</h1>
      <div class="flex items-center gap-2">
        <Button size="sm" ariaLabel="Go to Documents" tooltip="Go to Documents" onClick={() => goto('/')}>
          {#snippet icon()}
            <DocumentIcon />
          {/snippet}
        </Button>
        <Button size="sm" ariaLabel="Sign out" tooltip="Sign out" onClick={() => void authState.handleLogout()}>
          {#snippet icon()}
            <SignOutIcon />
          {/snippet}
        </Button>
      </div>
    </header>
  {/if}
  <main class="min-h-0 flex-1">
    {#if authState.state === 'checking'}
      <div class="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    {:else if authState.state === 'error'}
      <div class="flex h-full flex-col items-center justify-center gap-3 px-4">
        <p class="text-sm text-rose-400">{authState.sessionError}</p>
        <Button
          ariaLabel="Retry"
          tooltip="Retry"
          onClick={() => {
            authState.retry()
          }}>
          {#snippet icon()}
            <RefreshIcon />
          {/snippet}
        </Button>
      </div>
    {:else if authState.state === 'authenticated'}
      {#snippet propertiesToolbar(state: AdminState)}
        <Button
          size="sm"
          ariaLabel="Batch update settings"
          tooltip="Batch update"
          disabled={state.settingsState.pending}
          onClick={() => state.settingsState.openBatch()}>
          {#snippet icon()}
            <UploadIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          disabled={state.settingsState.pending}
          onClick={() => void state.settingsState.reload()}>
          {#snippet icon()}
            <RefreshIcon />
          {/snippet}
        </Button>
      {/snippet}
      {#snippet propertiesContent(state: AdminState)}
        <AdminPropertiesView settingsState={state.settingsState} />
      {/snippet}
      {#snippet documentsToolbar(state: AdminState)}
        <Button
          size="sm"
          ariaLabel="Add document"
          tooltip="Add document"
          onClick={() => state.documentsState.openAdd()}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Import documents"
          tooltip="Import documents"
          onClick={() => state.documentsState.openImport()}>
          {#snippet icon()}
            <UploadIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Export documents"
          tooltip="Export documents"
          pending={state.documentsState.exportPending}
          onClick={() => void state.documentsState.exportRecords()}>
          {#snippet icon()}
            <ExportIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Delete selected"
          tooltip="Delete selected"
          disabled={state.documentsState.selectedCount === 0}
          pending={state.documentsState.bulkDeletePending}
          onClick={() => (state.documentsState.bulkDeleteOpen = true)}
          className="text-slate-400 hover:border-rose-500 hover:text-rose-300">
          {#snippet icon()}
            <DeleteIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          disabled={state.documentsState.loading}
          onClick={() => void state.documentsState.load()}>
          {#snippet icon()}
            <RefreshIcon />
          {/snippet}
        </Button>
      {/snippet}
      {#snippet documentsContent(state: AdminState)}
        <AdminDocumentsView documentsState={state.documentsState} />
      {/snippet}
      {#snippet usersToolbar(state: AdminState)}
        <Button size="sm" ariaLabel="Add user" tooltip="Add user" onClick={() => state.usersState.openAdd()}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button size="sm" ariaLabel="Import users" tooltip="Import users" onClick={() => state.usersState.openImport()}>
          {#snippet icon()}
            <UploadIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Export users"
          tooltip="Export users"
          pending={state.usersState.exportPending}
          onClick={() => void state.usersState.exportRecords()}>
          {#snippet icon()}
            <ExportIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={state.usersState.selectedCount === 1 ? 'Edit selected user' : 'Set status'}
          tooltip={state.usersState.selectedCount === 1 ? 'Edit selected user' : 'Set status for selected users'}
          disabled={state.usersState.selectedCount === 0}
          onClick={() => state.usersState.handleToolbarEdit()}>
          {#snippet icon()}
            <EditIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Delete selected"
          tooltip="Delete selected"
          disabled={state.usersState.selectedCount === 0}
          pending={state.usersState.bulkDeletePending}
          onClick={() => (state.usersState.bulkDeleteOpen = true)}
          className="text-slate-400 hover:border-rose-500 hover:text-rose-300">
          {#snippet icon()}
            <DeleteIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          disabled={state.usersState.loading}
          onClick={() => void state.usersState.load()}>
          {#snippet icon()}
            <RefreshIcon />
          {/snippet}
        </Button>
      {/snippet}
      {#snippet usersContent(state: AdminState)}
        <AdminUsersView usersState={state.usersState} />
      {/snippet}
      {@const adminTabs = [
        {
          label: 'Properties',
          path: PROPERTIES_PATH,
          toolbar: propertiesToolbar,
          content: propertiesContent,
        },
        {
          label: 'Documents',
          path: DOCUMENTS_PATH,
          toolbar: documentsToolbar,
          content: documentsContent,
        },
        {
          label: 'Users',
          path: USERS_PATH,
          toolbar: usersToolbar,
          content: usersContent,
        },
      ] satisfies Tab<AdminState>[]}
      <div class="mx-auto flex h-full max-w-[96rem] flex-col gap-3 px-4 py-4">
        <Tabs
          tabs={adminTabs}
          state={{ settingsState, documentsState, usersState }}
          pathname={page.url.pathname}
          ariaLabel="Admin sections" />
      </div>
    {/if}
    {#if children}{@render children()}{/if}
  </main>
</div>

{#if discardPromptOpen}
  <ConfirmDialog
    title="Discard unsaved settings changes?"
    message="Your unsaved changes to application properties will be lost."
    confirmLabel="Discard"
    confirmColor="amber"
    onConfirm={handleDiscardAndNavigate}
    onCancel={handleCancelDiscard} />
{/if}
