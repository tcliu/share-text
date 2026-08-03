<script lang="ts">
  import { toast } from 'svelte-sonner'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { setShareTextContext } from '$lib/share-text-context'
  import DocumentList from '$lib/components/DocumentList.svelte'
  import Button from '$lib/components/Button.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { useDocuments } from '$lib/use-documents.svelte'
  import { useEditorGuard } from '$lib/use-editor-guard.svelte'

  let { children } = $props()

  const documentsState = useDocuments()
  const editorGuardState = useEditorGuard()

  let selectedDocumentRefreshToken = $state(0)
  let deleteTarget = $state<string | null>(null)
  let leftPaneCollapsed = $state(false)
  let adminDialogOpen = $state(false)

  const selectedId = $derived($page.params.id ?? null)

  function requestSelectedDocumentRefresh() {
    selectedDocumentRefreshToken += 1
  }

  async function handleNew() {
    if (!editorGuardState.canLeaveCurrentDocument()) {
      editorGuardState.requestDiscard({ kind: 'new' })
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

  function handleAdminDelete(id: string) {
    void documentsState.refreshList()
    if (editorGuardState.editorGuard?.getCurrentDocumentId() === id) {
      void goto('/')
    }
  }

  function handleAdminChange() {
    void documentsState.refreshList()
  }

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
  })

  $effect(() => {
    void documentsState.refreshList()
  })
</script>

<div class="flex h-screen overflow-hidden">
  {#if leftPaneCollapsed}
    <div class="flex w-11 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900/50 py-2">
      <Button size="sm" ariaLabel="Show document list" tooltip="Show document list" onClick={toggleLeftPane}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clip-rule="evenodd" />
          </svg>
        {/snippet}
      </Button>
    </div>
  {:else}
    <DocumentList
      documents={documentsState.documents}
      loading={documentsState.loadingDocuments}
      error={documentsState.documentsError}
      {selectedId}
      hasMore={documentsState.hasMore}
      onNew={handleNew}
      onRefresh={handleRefresh}
      onDelete={handleDelete}
      onRename={documentsState.commitRename}
      onLoadMore={documentsState.loadMore}
      onToggleCollapse={toggleLeftPane}
      onOpenAdmin={() => (adminDialogOpen = true)}
      deletePending={deleteTarget !== null} />
  {/if}
  <main class="flex min-w-0 flex-1">{@render children()}</main>
</div>

{#if editorGuardState.discardDialogOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="This document has unsaved changes that will be lost."
    confirmLabel="Discard"
    badgeColor="amber"
    badgeLabel="Confirm"
    confirmColor="amber"
    onConfirm={handleConfirmDiscard}
    onCancel={editorGuardState.handleCancelDiscard} />
{/if}

{#if deleteTarget !== null}
  <ConfirmDialog
    title="Delete document?"
    message="This document will be permanently deleted."
    confirmLabel="Delete"
    badgeColor="rose"
    badgeLabel="Confirm"
    confirmColor="rose"
    onConfirm={confirmDelete}
    onCancel={() => (deleteTarget = null)} />
{/if}

{#if adminDialogOpen}
  {#await import('$lib/components/AdminDialog.svelte') then module}
    {@const AdminDialog = module.default}
    <AdminDialog
      onClose={() => (adminDialogOpen = false)}
      onAdminDelete={handleAdminDelete}
      onAdminChange={handleAdminChange} />
  {/await}
{/if}
