<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { beforeNavigate, goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Buttons from '$lib/components/Buttons.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import LanguageMenu from '$lib/components/LanguageMenu.svelte'
  import OwnedDocumentsView from '$lib/components/OwnedDocumentsView.svelte'
  import SettingsGeneralView from '$lib/components/SettingsGeneralView.svelte'
  import SettingsProfileView from '$lib/components/SettingsProfileView.svelte'
  import SettingsReadAloudView from '$lib/components/SettingsReadAloudView.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import Tabs, { type Tab } from '$lib/components/Tabs.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import DocumentIcon from '$lib/icons/DocumentIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import { t } from '$lib/i18n.svelte'
  import { useOwnedDocuments } from '$lib/use-owned-documents.svelte'
  import { useUserSettings } from '$lib/use-user-settings.svelte'
  import { useUserAuth } from '$lib/use-user-auth.svelte'

  const PROFILE_PATH = '/settings/profile'
  const GENERAL_PATH = '/settings/general'
  const READ_ALOUD_PATH = '/settings/read-aloud'
  const DOCUMENTS_PATH = '/settings/documents'

  type SettingsState = {
    settingsState: ReturnType<typeof useUserSettings>
    documentsState: ReturnType<typeof useOwnedDocuments>
  }

  let { children }: { children?: Snippet } = $props()

  let discardPromptOpen = $state(false)
  let pendingNavigateUrl = $state<string | null>(null)

  const userAuthState = useUserAuth()
  const settingsState = useUserSettings(() => void handleSignedOut())
  const documentsState = useOwnedDocuments(() => void handleSignedOut())

  $effect(() => {
    if (userAuthState.state === 'signedOut') {
      void goto('/login')
    }
  })

  $effect(() => {
    if (userAuthState.state === 'signedIn') {
      void settingsState.load()
    }
  })

  $effect(() => {
    if (userAuthState.state !== 'signedIn') return
    if (page.url.pathname === DOCUMENTS_PATH && !documentsState.loaded) {
      void documentsState.load()
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

  async function handleSignedOut() {
    if (userAuthState.state === 'signedIn') {
      await userAuthState.signOut()
    }
    await goto('/login')
  }

  beforeNavigate(navigation => {
    if (!settingsState.hasUnsavedChanges) return
    const url = navigation.to?.url
    if (!url) return
    // Tab switches within /settings share this layout's state, so the draft
    // survives and must not prompt to discard changes.
    if (url.pathname === '/settings' || url.pathname.startsWith('/settings/')) {
      return
    }
    navigation.cancel()
    pendingNavigateUrl = url.pathname + url.search
    discardPromptOpen = true
  })

  onMount(() => {
    void userAuthState.checkSession()
  })
</script>

<svelte:head>
  <title>{t('settings.title')}</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <header class="flex flex-none items-center justify-between border-b border-slate-800 px-4 py-2">
    <h1 class="text-md font-semibold text-slate-200">{t('settings.title')}</h1>
    <div class="flex items-center gap-2">
      <LanguageMenu />
      <Button size="sm" ariaLabel={t('auth.goToDocuments')} tooltip={t('auth.goToDocuments')} onClick={() => goto('/')}>
        {#snippet icon()}
          <DocumentIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={t('list.signOut')}
        tooltip={t('list.signOut')}
        onClick={() => void handleSignedOut()}>
        {#snippet icon()}
          <SignOutIcon />
        {/snippet}
      </Button>
    </div>
  </header>
  <main class="min-h-0 flex-1">
    {#if userAuthState.state === 'checking'}
      <div class="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    {:else if userAuthState.state === 'signedIn'}
      {#snippet profileContent()}
        <SettingsProfileView user={userAuthState.user} />
      {/snippet}
      {#snippet generalContent(state: SettingsState)}
        <SettingsGeneralView settingsState={state.settingsState} />
      {/snippet}
      {#snippet readAloudContent(state: SettingsState)}
        <SettingsReadAloudView settingsState={state.settingsState} />
      {/snippet}
      {#snippet documentsToolbar(state: SettingsState)}
        <Button size="sm" ariaLabel={t('settings.documents.add')} tooltip={t('settings.documents.add')} onClick={() => goto('/new')}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('settings.documents.openSelected')}
          tooltip={t('settings.documents.openSelected')}
          disabled={state.documentsState.selectedCount !== 1}
          onClick={() => state.documentsState.openSelected()}>
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
      {#snippet documentsContent(state: SettingsState)}
        <OwnedDocumentsView documentsState={state.documentsState} />
      {/snippet}
      {@const settingsTabs = [
        {
          label: t('settings.tab.profile'),
          path: PROFILE_PATH,
          content: profileContent,
        },
        {
          label: t('settings.tab.general'),
          path: GENERAL_PATH,
          content: generalContent,
        },
        {
          label: t('settings.tab.readAloud'),
          path: READ_ALOUD_PATH,
          content: readAloudContent,
        },
        {
          label: t('settings.tab.documents'),
          path: DOCUMENTS_PATH,
          toolbar: documentsToolbar,
          content: documentsContent,
        },
      ] satisfies Tab<SettingsState>[]}
      <div class="mx-auto flex h-full max-w-[96rem] flex-col gap-3 px-4 py-4">
        <Tabs
          tabs={settingsTabs}
          state={{ settingsState, documentsState }}
          pathname={page.url.pathname}
          ariaLabel={t('settings.title')} />
        {#if page.url.pathname !== DOCUMENTS_PATH && page.url.pathname !== PROFILE_PATH}
          <Buttons>
            {#snippet children()}
              <Button
                variant="primary"
                accent="cyan"
                disabled={!settingsState.hasUnsavedChanges || settingsState.pending}
                pending={settingsState.pending}
                onClick={() => void settingsState.apply()}>
                {t('common.apply')}
              </Button>
              <Button disabled={settingsState.pending} onClick={() => void settingsState.reload()}>
                {t('common.reload')}
              </Button>
              <Button
                disabled={settingsState.pending || !settingsState.hasUnsavedChanges}
                onClick={() => settingsState.resetDraft()}>
                {t('common.reset')}
              </Button>
            {/snippet}
          </Buttons>
        {/if}
      </div>
    {/if}
    {#if children}{@render children()}{/if}
  </main>
</div>

{#if discardPromptOpen}
  <ConfirmDialog
    title={t('settings.discardTitle')}
    message={t('settings.discardMessage')}
    confirmLabel={t('common.ok')}
    confirmColor="amber"
    onConfirm={handleDiscardAndNavigate}
    onCancel={handleCancelDiscard} />
{/if}
