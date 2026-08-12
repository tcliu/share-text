<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { page } from '$app/state'
  import { beforeNavigate, goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import Tabs, { type Tab } from '$lib/components/Tabs.svelte'
  import AdminPropertiesView from '$lib/components/AdminPropertiesView.svelte'
  import AdminDocumentsView from '$lib/components/AdminDocumentsView.svelte'
  import { AdminAuthError, fetchAdminSession, logout } from '$lib/admin'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { useAdminDocuments } from '$lib/use-admin-documents.svelte'

  type AuthState = 'checking' | 'unauthenticated' | 'authenticated'
  const PROPERTIES_PATH = '/admin/properties'
  const DOCUMENTS_PATH = '/admin/documents'
  type AdminState = {
    settingsState: ReturnType<typeof useAdminSettings>
    documentsState: ReturnType<typeof useAdminDocuments>
  }

  let authState = $state<AuthState>('checking')
  let discardPromptOpen = $state(false)
  let pendingNavigateUrl = $state<string | null>(null)

  const settingsState = useAdminSettings(() => handleSignedOut())
  const documentsState = useAdminDocuments({ onSignedOut: () => handleSignedOut() })

  $effect(() => {
    if (authState === 'authenticated') {
      void settingsState.reload()
    }
  })

  $effect(() => {
    if (authState !== 'authenticated') return
    if (page.url.pathname === DOCUMENTS_PATH && !documentsState.loaded) {
      void documentsState.load()
    }
  })

  function redirectToLogin() {
    if (page.url.pathname !== '/login') {
      void goto('/login')
    }
  }

  function handleSignedOut() {
    settingsState.resetDraft()
    documentsState.reset()
    authState = 'unauthenticated'
    redirectToLogin()
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      toast.error('Failed to sign out')
    }
    handleSignedOut()
  }

  async function checkSession() {
    try {
      const session = await fetchAdminSession()
      if (session.authenticated) {
        authState = 'authenticated'
        return
      }
    } catch (error) {
      if (!(error instanceof AdminAuthError)) {
        toast.error(error instanceof Error ? error.message : 'Failed to check admin session')
      }
    }
    authState = 'unauthenticated'
    redirectToLogin()
  }

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
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/') || url.pathname === '/login') {
      return
    }
    navigation.cancel()
    pendingNavigateUrl = url.pathname + url.search
    discardPromptOpen = true
  })

  onMount(() => {
    void checkSession()
  })
</script>

<div class="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
  {#if authState === 'authenticated'}
  <header class="flex flex-none items-center justify-between border-b border-slate-800 px-4 py-2">
    <h1 class="text-md font-semibold text-slate-200">Admin</h1>
    <div class="flex items-center gap-2">
      <Button size="sm" ariaLabel="Go to Documents" tooltip="Go to Documents" onClick={() => goto('/')}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Sign out" tooltip="Sign out" onClick={() => void handleLogout()}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M3 4a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2H5v10h6a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V4Zm11.7 4.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-2 2a1 1 0 1 1-1.4-1.4l.3-.3H11a1 1 0 1 1 0-2h4.1l-.4-.3a1 1 0 0 1 0-1.4Z" />
            </svg>
          {/snippet}
        </Button>
    </div>
  </header>
  {/if}
  <main class="min-h-0 flex-1">
    {#if authState === 'checking'}
      <div class="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    {:else if authState === 'authenticated'}
      {#snippet propertiesToolbar(state: AdminState)}
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          disabled={state.settingsState.pending}
          onClick={() => void state.settingsState.reload()}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
            </svg>
          {/snippet}
        </Button>
      {/snippet}
      {#snippet propertiesContent(state: AdminState)}
        <AdminPropertiesView settingsState={state.settingsState} />
      {/snippet}
      {#snippet documentsToolbar(state: AdminState)}
        <Button
          size="sm"
          ariaLabel="Delete selected"
          tooltip="Delete selected"
          disabled={state.documentsState.selectedCount === 0}
          pending={state.documentsState.bulkDeletePending}
          onClick={() => (state.documentsState.bulkDeleteOpen = true)}
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
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          disabled={state.documentsState.loading}
          onClick={() => void state.documentsState.load()}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
            </svg>
          {/snippet}
        </Button>
      {/snippet}
      {#snippet documentsContent(state: AdminState)}
        <AdminDocumentsView documentsState={state.documentsState} />
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
      ] satisfies Tab<AdminState>[]}
      <div class="mx-auto flex h-full max-w-[96rem] flex-col gap-3 px-4 py-4">
        <Tabs tabs={adminTabs} state={{ settingsState, documentsState }} pathname={page.url.pathname} />
      </div>
    {/if}
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
