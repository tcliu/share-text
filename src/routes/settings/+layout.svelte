<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { beforeNavigate, goto } from '$app/navigation'
  import Button from '$lib/components/Button.svelte'
  import Buttons from '$lib/components/Buttons.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import LanguageMenu from '$lib/components/LanguageMenu.svelte'
  import ThemeMenu from '$lib/components/ThemeMenu.svelte'
  import OwnedDocumentsView from '$lib/components/OwnedDocumentsView.svelte'
  import SettingsGeneralView from '$lib/components/SettingsGeneralView.svelte'
  import SettingsProfileView from '$lib/components/SettingsProfileView.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import Tabs, { type Tab } from '$lib/components/Tabs.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import SignOutIcon from '$lib/icons/SignOutIcon.svelte'
  import DocumentIcon from '$lib/icons/DocumentIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import PlusIcon from '$lib/icons/PlusIcon.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import { useOwnedDocuments } from '$lib/use-owned-documents.svelte'
  import { useUserSettings } from '$lib/use-user-settings.svelte'
  import { useUserAuth } from '$lib/use-user-auth.svelte'

  const PROFILE_PATH = '/settings/profile'
  const GENERAL_PATH = '/settings/general'
  const DOCUMENTS_PATH = '/settings/documents'

  type SettingsState = {
    settingsState: ReturnType<typeof useUserSettings>
    documentsState: ReturnType<typeof useOwnedDocuments>
  }

  let { children }: { children?: Snippet } = $props()

  let discardPromptOpen = $state(false)
  let pendingNavigateUrl = $state<string | null>(null)

  const userAuthState = useUserAuth()
  const settingsState = useUserSettings(() => void handleExpiredSession())
  const documentsState = useOwnedDocuments(() => void handleExpiredSession())

  // Explicit sign-out navigates to the landing page via handleSignedOut; this
  // effect only covers expired sessions (kept on /login = landing + dialog).
  let suppressSignedOutRedirect = false

  $effect(() => {
    if (userAuthState.state === 'signedOut' && !suppressSignedOutRedirect) {
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
    suppressSignedOutRedirect = true
    try {
      if (userAuthState.state === 'signedIn') {
        await userAuthState.signOut()
      }
      await goto('/')
    } finally {
      suppressSignedOutRedirect = false
    }
  }

  async function handleExpiredSession() {
    if (userAuthState.state === 'signedIn') {
      await userAuthState.signOut()
    }
    // The signedOut effect above routes to /login (landing + dialog).
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
  <title>{i18n.t('settings.title')}</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <header class="flex flex-none items-center justify-between gap-4 border-b border-slate-800 px-3 py-3 sm:px-4">
    <h1 class="text-base font-semibold tracking-tight text-slate-200 sm:text-lg">{i18n.t('settings.title')}</h1>
    <div class="flex items-center gap-2">
      <ThemeMenu align="right" />
      <LanguageMenu align="right" />
      <Button size="sm" ariaLabel={i18n.t('auth.goToDocuments')} tooltip={i18n.t('auth.goToDocuments')} onClick={() => goto('/')}>
        {#snippet icon()}
          <DocumentIcon />
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel={i18n.t('list.signOut')}
        tooltip={i18n.t('list.signOut')}
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
      {#snippet documentsToolbar(state: SettingsState)}
        <Button size="sm" ariaLabel={i18n.t('settings.documents.add')} tooltip={i18n.t('settings.documents.add')} onClick={() => goto('/new')}>
          {#snippet icon()}
            <PlusIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={i18n.t('settings.documents.openSelected')}
          tooltip={i18n.t('settings.documents.openSelected')}
          disabled={state.documentsState.selectedCount !== 1}
          onClick={() => state.documentsState.openSelected()}>
          {#snippet icon()}
            <EditIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={i18n.t('admin.deleteSelected')}
          tooltip={i18n.t('admin.deleteSelected')}
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
          ariaLabel={i18n.t('common.reload')}
          tooltip={i18n.t('common.reload')}
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
          label: i18n.t('settings.tab.profile'),
          path: PROFILE_PATH,
          content: profileContent,
        },
        {
          label: i18n.t('settings.tab.general'),
          path: GENERAL_PATH,
          content: generalContent,
        },
        {
          label: i18n.t('settings.tab.documents'),
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
          ariaLabel={i18n.t('settings.title')}
          class="bg-slate-950" />
        {#if page.url.pathname !== DOCUMENTS_PATH && page.url.pathname !== PROFILE_PATH}
          <Buttons>
            {#snippet children()}
              <Button
                variant="primary"
                accent="cyan"
                disabled={!settingsState.hasUnsavedChanges || settingsState.pending}
                pending={settingsState.pending}
                onClick={() => void settingsState.apply()}>
                {i18n.t('common.apply')}
              </Button>
              <Button disabled={settingsState.pending} onClick={() => void settingsState.reload()}>
                {i18n.t('common.reload')}
              </Button>
              <Button
                disabled={settingsState.pending || !settingsState.hasUnsavedChanges}
                onClick={() => settingsState.resetDraft()}>
                {i18n.t('common.reset')}
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
    title={i18n.t('settings.discardTitle')}
    message={i18n.t('settings.discardMessage')}
    confirmLabel={i18n.t('common.ok')}
    confirmColor="amber"
    onConfirm={handleDiscardAndNavigate}
    onCancel={handleCancelDiscard} />
{/if}
