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
  import AdminGeneralView from '$lib/components/AdminGeneralView.svelte'
  import AdminPropertiesView from '$lib/components/AdminPropertiesView.svelte'
  import AdminDocumentsView from '$lib/components/AdminDocumentsView.svelte'
  import AdminUsersView from '$lib/components/AdminUsersView.svelte'
  import AdminTextToSpeechView from '$lib/components/AdminTextToSpeechView.svelte'
  import LanguageMenu from '$lib/components/LanguageMenu.svelte'
  import { useAdminAuth } from '$lib/use-admin-auth.svelte'
  import { useAdminPreferences } from '$lib/use-admin-preferences.svelte'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import { useAdminUsers } from '$lib/use-admin-users.svelte'
  import { useAdminSegments } from '$lib/use-admin-segments.svelte'
  import { useAdminTtsVoices } from '$lib/use-admin-tts-voices.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'
  import ExportIcon from '$lib/icons/ExportIcon.svelte'
  import { t } from '$lib/i18n.svelte'

  const GENERAL_PATH = '/admin/general'
  const PROPERTIES_PATH = '/admin/properties'
  const DOCUMENTS_PATH = '/admin/documents'
  const USERS_PATH = '/admin/users'
  const TTS_PATH = '/admin/text-to-speech'
  type AdminState = {
    preferencesState: ReturnType<typeof useAdminPreferences>
    settingsState: ReturnType<typeof useAdminSettings>
    documentsState: ReturnType<typeof useAdminDocuments>
    usersState: ReturnType<typeof useAdminUsers>
    segmentsState: ReturnType<typeof useAdminSegments>
    voicesState: ReturnType<typeof useAdminTtsVoices>
  }

  let { children }: { children?: Snippet } = $props()

  let discardPromptOpen = $state(false)
  let pendingNavigateUrl = $state<string | null>(null)

  const preferencesState = useAdminPreferences(() => authState.handleSignedOut())
  const settingsState = useAdminSettings(() => authState.handleSignedOut())
  const documentsState = useAdminDocuments({ onSignedOut: () => authState.handleSignedOut() })
  const usersState = useAdminUsers({ onSignedOut: () => authState.handleSignedOut() })
  const segmentsState = useAdminSegments()
  const voicesState = useAdminTtsVoices(() => authState.handleSignedOut())
  const authState = useAdminAuth({
    onSignedOut() {
      preferencesState.reset()
      settingsState.reset()
      documentsState.reset()
      usersState.reset()
      segmentsState.reset()
      voicesState.reset()
    },
  })

  $effect(() => {
    if (authState.state === 'authenticated') {
      void preferencesState.load()
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

  $effect(() => {
    if (authState.state !== 'authenticated') return
    if (page.url.pathname === TTS_PATH && !segmentsState.loaded) {
      void segmentsState.reload()
    }
    if (page.url.pathname === TTS_PATH && !voicesState.loaded) {
      void voicesState.load()
    }
  })

  function handleDiscardAndNavigate() {
    const url = pendingNavigateUrl
    pendingNavigateUrl = null
    discardPromptOpen = false
    if (!url) return
    preferencesState.resetDraft()
    settingsState.resetDraft()
    voicesState.resetDraft()
    void goto(url)
  }

  function handleCancelDiscard() {
    pendingNavigateUrl = null
    discardPromptOpen = false
  }

  beforeNavigate(navigation => {
    if (!preferencesState.hasUnsavedChanges && !settingsState.hasUnsavedChanges && !voicesState.hasUnsavedChanges) return
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
  <title>{t('admin.title')}</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  {#if authState.state === 'authenticated'}
    <header class="flex flex-none items-center justify-between border-b border-slate-800 px-4 py-2">
      <h1 class="text-md font-semibold text-slate-200">{t('admin.title')}</h1>
      <div class="flex items-center gap-2">
        <LanguageMenu />
        <Button size="sm" ariaLabel={t('auth.goToDocuments')} tooltip={t('auth.goToDocuments')} onClick={() => goto('/')}>
          {#snippet icon()}
            <DocumentIcon />
          {/snippet}
        </Button>
        <Button size="sm" ariaLabel={t('list.signOut')} tooltip={t('list.signOut')} onClick={() => void authState.handleLogout()}>
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
          ariaLabel={t('common.retry')}
          tooltip={t('common.retry')}
          onClick={() => {
            authState.retry()
          }}>
          {#snippet icon()}
            <RefreshIcon />
          {/snippet}
        </Button>
      </div>
    {:else if authState.state === 'authenticated'}
      {#snippet generalContent(state: AdminState)}
        <AdminGeneralView preferencesState={state.preferencesState} />
      {/snippet}
      {#snippet propertiesContent(state: AdminState)}
        <AdminPropertiesView settingsState={state.settingsState} />
      {/snippet}
      {#snippet documentsToolbar(state: AdminState)}
        <Button
          size="sm"
          ariaLabel={t('admin.documents.add')}
          tooltip={t('admin.documents.add')}
          onClick={() => state.documentsState.openAdd()}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.documents.import')}
          tooltip={t('admin.documents.import')}
          onClick={() => state.documentsState.openImport()}>
          {#snippet icon()}
            <UploadIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.documents.export')}
          tooltip={t('admin.documents.export')}
          pending={state.documentsState.exportPending}
          onClick={() => void state.documentsState.exportRecords()}>
          {#snippet icon()}
            <ExportIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.documents.editSelected')}
          tooltip={t('admin.documents.editSelected')}
          disabled={state.documentsState.selectedCount !== 1}
          onClick={() => state.documentsState.handleToolbarEdit()}>
          {#snippet icon()}
            <EditIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.deleteSelected')}
          tooltip={t('admin.deleteSelected')}
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
          ariaLabel={t('common.reload')}
          tooltip={t('common.reload')}
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
        <Button size="sm" ariaLabel={t('admin.users.add')} tooltip={t('admin.users.add')} onClick={() => state.usersState.openAdd()}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button size="sm" ariaLabel={t('admin.users.import')} tooltip={t('admin.users.import')} onClick={() => state.usersState.openImport()}>
          {#snippet icon()}
            <UploadIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.users.export')}
          tooltip={t('admin.users.export')}
          pending={state.usersState.exportPending}
          onClick={() => void state.usersState.exportRecords()}>
          {#snippet icon()}
            <ExportIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={state.usersState.selectedCount === 1 ? t('admin.users.editSelected') : t('admin.users.setStatus')}
          tooltip={state.usersState.selectedCount === 1 ? t('admin.users.editSelected') : t('admin.users.setStatusFor')}
          disabled={state.usersState.selectedCount === 0}
          onClick={() => state.usersState.handleToolbarEdit()}>
          {#snippet icon()}
            <EditIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('admin.deleteSelected')}
          tooltip={t('admin.deleteSelected')}
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
          ariaLabel={t('common.reload')}
          tooltip={t('common.reload')}
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
      {#snippet ttsContent(state: AdminState)}
        <AdminTextToSpeechView segmentsState={state.segmentsState} voicesState={state.voicesState} />
      {/snippet}
      {@const adminTabs = [
        {
          label: t('admin.tab.general'),
          path: GENERAL_PATH,
          content: generalContent,
        },
        {
          label: t('admin.tab.properties'),
          path: PROPERTIES_PATH,
          content: propertiesContent,
        },
        {
          label: t('admin.tab.documents'),
          path: DOCUMENTS_PATH,
          toolbar: documentsToolbar,
          content: documentsContent,
        },
        {
          label: t('admin.tab.users'),
          path: USERS_PATH,
          toolbar: usersToolbar,
          content: usersContent,
        },
        {
          label: t('admin.tab.tts'),
          path: TTS_PATH,
          content: ttsContent,
        },
      ] satisfies Tab<AdminState>[]}
      <div class="mx-auto flex h-full max-w-[96rem] flex-col gap-3 px-4 py-4">
        <Tabs
          tabs={adminTabs}
          state={{ preferencesState, settingsState, documentsState, usersState, segmentsState, voicesState }}
          pathname={page.url.pathname}
          ariaLabel={t('admin.sections')} />
      </div>
    {/if}
    {#if children}{@render children()}{/if}
  </main>
</div>

{#if discardPromptOpen}
  <ConfirmDialog
    title={t('admin.discardSettingsTitle')}
    message={t('admin.discardSettingsMessage')}
    confirmLabel={t('admin.discard')}
    confirmColor="amber"
    onConfirm={handleDiscardAndNavigate}
    onCancel={handleCancelDiscard} />
{/if}
