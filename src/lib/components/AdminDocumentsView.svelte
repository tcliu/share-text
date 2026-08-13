<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Copyable from './Copyable.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'
  import Chip from './Chip.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'
  import { formatTimestamp } from '$lib/date-format'
  import type { Tag } from '$lib/tag-colors'
  import ExternalLinkIcon from '$lib/icons/ExternalLinkIcon.svelte'

  interface Props {
    documentsState: ReturnType<typeof useAdminDocuments>
  }

  let { documentsState }: Props = $props()

  function formatSize(value: number) {
    return value.toLocaleString()
  }

  function formatTags(tags: Tag[] | undefined) {
    return tags?.map(tag => tag.name).join(', ') ?? ''
  }

  const columns: DataTableColumn<AdminDocumentSummary>[] = [
    {
      key: 'id',
      header: 'Key',
      width: '10%',
      minWidth: 160,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: idCell,
    },
    {
      key: 'name',
      header: 'Name',
      width: '18%',
      minWidth: 160,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: nameCell,
    },
    {
      key: 'documentType',
      header: 'Type',
      width: '9%',
      sortable: true,
      searchable: true,
      cell: documentTypeCell,
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '14%',
      cellClass: 'max-w-0',
      searchable: true,
      cell: tagsCell,
    },
    {
      key: 'length',
      header: 'Length',
      width: '9%',
      cellClass: 'text-slate-400',
      sortable: true,
      cell: lengthCell,
    },
    {
      key: 'createdBy',
      header: 'Created by',
      width: '13%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: createdByCell,
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      width: '13%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: updatedByCell,
    },
    {
      key: 'access',
      header: 'Access',
      width: '9%',
      minWidth: 96,
      cell: accessCell,
    },
    {
      key: 'updatedAt',
      header: 'Updated time',
      width: '14%',
      minWidth: 144,
      cellClass: 'text-slate-500',
      sortable: true,
      cell: updatedAtCell,
    },
  ]
</script>

<DataTable
  rows={documentsState.documents}
  rowId={document => document.id}
  {columns}
  loading={documentsState.loading}
  emptyMessage={documentsState.searchQuery ? 'No documents match your filter.' : 'No documents yet.'}
  bind:searchValue={documentsState.searchInput}
  onSearchInput={() => documentsState.handleSearchInput()}
  onSearchKeydown={event => documentsState.handleSearchKeydown(event)}
  searchAriaLabel="Search all documents"
  searchPlaceholder="Search documents..."
  bind:searchKeys={documentsState.searchKeys}
  selectable
  selectedIds={documentsState.selectedIds}
  onToggleSelection={(id, checked) => documentsState.toggleSelection(id, checked)}
  onToggleAll={() => documentsState.toggleAllOnCurrentPage()}
  allSelected={documentsState.currentPageAllSelected}
  someSelected={documentsState.currentPageSomeSelected}
  rowSelectAriaLabel={document => `Select document ${document.name}`}
  selectAllAriaLabel="Select all documents"
  total={documentsState.total}
  pageSize={documentsState.pageSize}
  currentPage={documentsState.page}
  onPageChange={nextPage => documentsState.handlePageChange(nextPage)}
  onPageSizeChange={size => documentsState.handlePageSizeChange(size)}
  sortKey={documentsState.sortBy}
  sortDirection={documentsState.sortDir}
  onSort={(key, direction) => documentsState.handleSort(key, direction)}
  fillHeight />

{#snippet idCell(document: AdminDocumentSummary)}
  <div class="group flex min-w-0 items-center gap-1">
    <EditableText
      text={document.id}
      size="sm"
      className="font-mono text-slate-500"
      copyable
      onChange={key => void documentsState.updateKey(document.id, key)} />
    <a
      href={`/${document.id}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open document ${document.id}`}
      class="shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-cyan-300"
      onclick={(e) => e.stopPropagation()}>
      <ExternalLinkIcon />
    </a>
  </div>
{/snippet}

{#snippet nameCell(document: AdminDocumentSummary)}
  <EditableText
    text={document.name}
    size="sm"
    className="text-slate-200"
    copyable
    onChange={name => void documentsState.rename(document.id, name)} />
{/snippet}

{#snippet documentTypeCell(document: AdminDocumentSummary)}
  <Copyable
    text={document.documentType}
    className="text-slate-400 capitalize"
    copyAriaLabel={`Copy document type ${document.documentType}`} />
{/snippet}

{#snippet tagsCell(document: AdminDocumentSummary)}
  {#if (document.tags ?? []).length > 0}
    <Copyable
      text={formatTags(document.tags)}
      className="block text-slate-400"
      copyAriaLabel={`Copy tags for ${document.name}`}>
      <span class="flex flex-wrap gap-1">
        {#each document.tags as tag (tag.name)}
          <Chip label={tag.name} chipClass={tagChipClass()} style={tagChipStyle(tag.color)} />
        {/each}
      </span>
    </Copyable>
  {/if}
{/snippet}

{#snippet lengthCell(document: AdminDocumentSummary)}
  {formatSize(document.contentSize)}
{/snippet}

{#snippet createdByCell(document: AdminDocumentSummary)}
  <EditableText
    text={document.createdBy}
    size="sm"
    className="text-slate-400"
    copyable
    onChange={createdBy => void documentsState.updateCreatedBy(document.id, createdBy)} />
{/snippet}

{#snippet updatedByCell(document: AdminDocumentSummary)}
  <EditableText
    text={document.updatedBy}
    size="sm"
    className="text-slate-400"
    copyable
    onChange={updatedBy => void documentsState.updateUpdatedBy(document.id, updatedBy)} />
{/snippet}

{#snippet accessCell(document: AdminDocumentSummary)}
  <button
    type="button"
    aria-label={`Change access for ${document.name}`}
    aria-pressed={!document.isPublic}
    onclick={() => void documentsState.updateIsPublic(document.id, !document.isPublic)}
    class={`rounded-md border px-2 py-0.5 text-xs font-semibold transition ${
      document.isPublic
        ? 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500 hover:text-cyan-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400'
    }`}>
    {document.isPublic ? 'Public' : 'Private'}
  </button>
{/snippet}

{#snippet updatedAtCell(document: AdminDocumentSummary)}
  {formatTimestamp(document.updatedAt)}
{/snippet}

{#if documentsState.deleteTarget}
  <ConfirmDialog
    title="Delete document?"
    message={`"${documentsState.deleteTarget.name}" will be permanently deleted for everyone.`}
    confirmLabel="Delete"
    confirmColor="rose"
    onConfirm={() => void documentsState.confirmDelete()}
    onCancel={() => (documentsState.deleteTarget = null)} />
{/if}

{#if documentsState.bulkDeleteOpen}
  <ConfirmDialog
    title={`Delete ${documentsState.selectedCount} document${documentsState.selectedCount === 1 ? '' : 's'}?`}
    message="The selected documents will be permanently deleted for everyone."
    confirmLabel="Delete"
    confirmColor="rose"
    onConfirm={() => void documentsState.confirmBulkDelete()}
    onCancel={() => (documentsState.bulkDeleteOpen = false)} />
{/if}
