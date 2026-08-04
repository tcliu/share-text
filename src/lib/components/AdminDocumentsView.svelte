<script lang="ts">
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Pagination from './Pagination.svelte'
  import SearchInput from './SearchInput.svelte'
  import Spinner from './Spinner.svelte'
  import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'

  interface Props {
    documentsState: ReturnType<typeof useAdminDocuments>
  }

  let { documentsState }: Props = $props()

  function formatTime(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }

  function formatSize(value: number) {
    return value.toLocaleString()
  }
</script>

{#if documentsState.viewingDocument}
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
      <div class="min-w-0">
        <h3 class="truncate text-base font-semibold text-slate-100">{documentsState.viewingDocument.name}</h3>
        <p class="mt-0.5 text-xs text-slate-500">
          Created by <span class="text-slate-300">{documentsState.viewingDocument.createdBy}</span> · Last edited by{' '}
          <span class="text-slate-300">{documentsState.viewingDocument.updatedBy}</span> · {formatTime(
            documentsState.viewingDocument.updatedAt,
          )}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          size="sm"
          ariaLabel="Rename document"
          tooltip="Rename"
          onClick={() => documentsState.startRename(documentsState.viewingDocument!)}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path
                d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Delete document"
          tooltip="Delete"
          onClick={() => (documentsState.deleteTarget = documentsState.viewingDocument)}
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
        <Button size="sm" ariaLabel="Back to document list" tooltip="Back" onClick={() => documentsState.backToList()}>
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
    </div>
    <pre
      class="mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">{documentsState.viewingDocument.content}</pre>
  </div>
{:else}
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <SearchInput
      bind:value={documentsState.searchInput}
      oninput={() => documentsState.handleSearchInput()}
      onkeydown={event => documentsState.handleSearchKeydown(event)}
      ariaLabel="Search all documents"
      placeholder="Search documents..." />

    <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/50">
      <table
        class="w-full min-w-[44rem] border-separate border-spacing-0 text-sm [&_tr:last-child_td]:border-b-0">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
            <th
              class="sticky top-0 z-10 w-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur">
              <Checkbox
                checked={documentsState.currentPageAllSelected}
                indeterminate={documentsState.currentPageSomeSelected && !documentsState.currentPageAllSelected}
                ariaLabel="Select all documents"
                disabled={documentsState.documents.length === 0}
                onChange={() => documentsState.toggleAllOnCurrentPage()} />
            </th>
            <th class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur"
              >Name</th>
            <th class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur"
              >Length</th>
            <th class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur"
              >Updated by</th>
            <th class="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur"
              >Updated time</th>
          </tr>
        </thead>
        <tbody>
          {#if documentsState.loading && documentsState.documents.length === 0}
            <tr>
              <td colspan="5" class="px-3 py-10">
                <div class="flex justify-center">
                  <Spinner className="h-6 w-6" />
                </div>
              </td>
            </tr>
          {:else if documentsState.documents.length === 0}
            <tr>
              <td colspan="5" class="px-3 py-10 text-center text-sm text-slate-500">
                {documentsState.searchQuery ? 'No documents match your filter.' : 'No documents yet.'}
              </td>
            </tr>
          {:else}
            {#each documentsState.documents as document}
              <tr class="hover:bg-slate-900/40">
                <td class="border-b border-slate-800/50 px-3 py-2">
                  <Checkbox
                    checked={documentsState.selectedIds.has(document.id)}
                    ariaLabel={`Select document ${document.name}`}
                    onChange={checked => documentsState.toggleSelection(document.id, checked)} />
                </td>
                <td class="max-w-0 border-b border-slate-800/50 px-3 py-2">
                  {#if documentsState.renamingId === document.id}
                    <div class="flex items-center gap-1.5">
                      <input
                        bind:value={documentsState.renameValue}
                        onkeydown={event => {
                          if (event.key === 'Enter') void documentsState.confirmRename()
                          if (event.key === 'Escape') documentsState.cancelRename()
                        }}
                        aria-label="Rename document input"
                        class="w-40 rounded-md border border-cyan-600 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none" />
                      <Button
                        size="sm"
                        ariaLabel="Confirm rename"
                        tooltip="Save"
                        onClick={() => void documentsState.confirmRename()}
                        pending={documentsState.renamePending}
                        className="text-slate-400">
                        {#snippet icon()}
                          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fill-rule="evenodd"
                              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                              clip-rule="evenodd" />
                          </svg>
                        {/snippet}
                      </Button>
                      <Button
                        size="sm"
                        ariaLabel="Cancel rename"
                        tooltip="Cancel"
                        onClick={() => documentsState.cancelRename()}
                        className="text-slate-400">
                        {#snippet icon()}
                          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              d="M6.28 5.22a1 1 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a1 1 0 1 0 1.06 1.06L10 11.06l3.72 3.72a1 1 0 1 0 1.06-1.06L11.06 10l3.72-3.72a1 1 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                          </svg>
                        {/snippet}
                      </Button>
                    </div>
                  {:else}
                    <button
                      type="button"
                      class="block w-full truncate text-left text-slate-200 hover:text-cyan-300"
                      onclick={() => void documentsState.viewDocument(document)}>
                      {document.name}
                    </button>
                  {/if}
                </td>
                <td class="border-b border-slate-800/50 px-3 py-2 text-slate-400"
                  >{formatSize(document.contentSize)}</td>
                <td class="border-b border-slate-800/50 px-3 py-2 text-slate-400">{document.updatedBy}</td>
                <td class="border-b border-slate-800/50 px-3 py-2 text-slate-500"
                  >{formatTime(document.updatedAt)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="shrink-0">
      <Pagination
        total={documentsState.total}
        pageSize={documentsState.pageSize}
        currentPage={documentsState.page}
        onPageChange={nextPage => documentsState.handlePageChange(nextPage)}
        onPageSizeChange={size => documentsState.handlePageSizeChange(size)} />
    </div>
  </div>
{/if}

{#if documentsState.deleteTarget}
  <ConfirmDialog
    title="Delete document?"
    message={`"${documentsState.deleteTarget.name}" will be permanently deleted for everyone.`}
    confirmLabel="Delete"
    badgeColor="rose"
    badgeLabel="Confirm"
    confirmColor="rose"
    onConfirm={() => void documentsState.confirmDelete()}
    onCancel={() => (documentsState.deleteTarget = null)} />
{/if}

{#if documentsState.bulkDeleteOpen}
  <ConfirmDialog
    title={`Delete ${documentsState.selectedCount} document${documentsState.selectedCount === 1 ? '' : 's'}?`}
    message="The selected documents will be permanently deleted for everyone."
    confirmLabel="Delete"
    badgeColor="rose"
    badgeLabel="Confirm"
    confirmColor="rose"
    onConfirm={() => void documentsState.confirmBulkDelete()}
    onCancel={() => (documentsState.bulkDeleteOpen = false)} />
{/if}
