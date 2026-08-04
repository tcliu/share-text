<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import AdminPropertiesView from './AdminPropertiesView.svelte'
  import AdminDocumentsView from './AdminDocumentsView.svelte'
  import { logout } from '$lib/admin'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { useAdminDocuments } from '$lib/use-admin-documents.svelte'

  interface Props {
    onClose: () => void
    onSignedOut: () => void
    onAdminDelete: (id: string) => void
    onAdminChange: () => void
  }

  let { onClose, onSignedOut, onAdminDelete, onAdminChange }: Props = $props()

  let activeTab = $state<'properties' | 'documents'>('properties')
  let discardPromptOpen = $state(false)

  const settingsState = useAdminSettings(() => onSignedOut())
  const documentsState = useAdminDocuments({
    onSignedOut: () => onSignedOut(),
    onAdminDelete: (id) => onAdminDelete(id),
    onAdminChange: () => onAdminChange(),
  })

  function selectTab(tab: 'properties' | 'documents') {
    activeTab = tab
    if (tab === 'documents' && !documentsState.loaded) {
      void documentsState.load()
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      toast.error('Failed to sign out')
    }
    onSignedOut()
  }

  function handleHeaderRefresh() {
    if (activeTab === 'documents') {
      void documentsState.load()
    } else {
      void settingsState.reload()
    }
  }

  function handleCloseRequest() {
    if (discardPromptOpen || documentsState.deleteTarget !== null || documentsState.bulkDeleteOpen) {
      return
    }
    if (settingsState.hasUnsavedChanges) {
      discardPromptOpen = true
      return
    }
    onClose()
  }

  function handleDiscard() {
    discardPromptOpen = false
    onClose()
  }

  onMount(() => {
    void settingsState.reload()
  })
</script>

<BaseDialog
  title="Admin"
  maxWidth="fit"
  pending={settingsState.pending || documentsState.loading}
  allowPendingCancel
  dismissKeydownCapture={!discardPromptOpen && documentsState.deleteTarget === null && !documentsState.bulkDeleteOpen}
  onCancel={handleCloseRequest}>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
        <button
          type="button"
          class={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === 'properties' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-cyan-300'}`}
          onclick={() => selectTab('properties')}>
          Properties
        </button>
        <button
          type="button"
          class={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === 'documents' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-cyan-300'}`}
          onclick={() => selectTab('documents')}>
          Documents
        </button>
      </div>
      <div class="flex items-center gap-2">
        {#if activeTab === 'documents'}
          <Button
            size="sm"
            ariaLabel="Delete selected"
            tooltip="Delete selected"
            disabled={documentsState.selectedCount === 0}
            pending={documentsState.bulkDeletePending}
            onClick={() => (documentsState.bulkDeleteOpen = true)}
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
        {/if}
        <Button
          size="sm"
          ariaLabel="Reload"
          tooltip="Reload"
          onClick={handleHeaderRefresh}
          disabled={settingsState.pending || documentsState.loading}>
          {#snippet icon()}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
            </svg>
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Sign out"
          tooltip="Sign out"
          tooltipAlign="right"
          onClick={() => void handleLogout()}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M3 4a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2H5v10h6a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V4Zm11.7 4.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-2 2a1 1 0 1 1-1.4-1.4l.3-.3H11a1 1 0 1 1 0-2h4.1l-.4-.3a1 1 0 0 1 0-1.4Z" />
            </svg>
          {/snippet}
        </Button>
      </div>
    </div>

    {#if activeTab === 'properties'}
      <AdminPropertiesView {settingsState} />
    {:else}
      <AdminDocumentsView {documentsState} />
    {/if}
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title="Discard unsaved settings changes?"
    message="Your unsaved changes to application properties will be lost."
    confirmLabel="Discard"
    badgeColor="amber"
    badgeLabel="Confirm"
    confirmColor="amber"
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
