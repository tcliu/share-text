<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Copyable from './Copyable.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import EditDocumentDialog from './EditDocumentDialog.svelte'
  import Button from './Button.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'
  import Chip from './Chip.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'
  import { formatTimestamp } from '$lib/date-format'
  import type { Tag } from '$lib/tag-colors'

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
      width: '17%',
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
      width: '8%',
      cellClass: 'text-slate-400',
      sortable: true,
      cell: lengthCell,
    },
    {
      key: 'createdBy',
      header: 'Created by',
      width: '12%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: createdByCell,
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      width: '12%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: updatedByCell,
    },
    {
      key: 'access',
      header: 'Access',
      width: '8%',
      minWidth: 96,
      cell: accessCell,
    },
    {
      key: 'updatedAt',
      header: 'Updated time',
      width: '12%',
      minWidth: 144,
      cellClass: 'text-slate-500',
      sortable: true,
      cell: updatedAtCell,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '8%',
      minWidth: 96,
      cell: actionsCell,
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
  fillHeight
  resizable
  storageKey="admin-documents" />

{#snippet idCell(document: AdminDocumentSummary)}
  <EditableText
    text={document.id}
    size="sm"
    className="font-mono text-slate-500 transition-colors hover:text-cyan-300"
    copyable
    onActivate={() => window.open(`/${document.id}`, '_blank', 'noopener')}
    onChange={key => void documentsState.updateKey(document.id, key)} />
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
  <Copyable
    text={document.createdBy}
    className="block truncate text-slate-400"
    copyAriaLabel={`Copy created by ${document.createdBy}`} />
{/snippet}

{#snippet updatedByCell(document: AdminDocumentSummary)}
  <Copyable
    text={document.updatedBy}
    className="block truncate text-slate-400"
    copyAriaLabel={`Copy updated by ${document.updatedBy}`} />
{/snippet}

{#snippet accessCell(document: AdminDocumentSummary)}
  <span
    class={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
      document.isPublic
        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-700 bg-slate-950 text-slate-400'
    }`}>
    {document.isPublic ? 'Public' : 'Private'}
  </span>
{/snippet}

{#snippet updatedAtCell(document: AdminDocumentSummary)}
  {formatTimestamp(document.updatedAt)}
{/snippet}

{#snippet actionsCell(document: AdminDocumentSummary)}
  <div class="flex items-center gap-1">
    <Button size="sm" ariaLabel={`Edit document ${document.name}`} tooltip="Edit" onClick={() => documentsState.openEdit(document)}>
      {#snippet icon()}
        <EditIcon />
      {/snippet}
    </Button>
    <Button
      size="sm"
      ariaLabel={`Delete document ${document.name}`}
      tooltip="Delete"
      className="text-slate-400 hover:border-rose-500 hover:text-rose-300"
      onClick={() => (documentsState.deleteTarget = document)}>
      {#snippet icon()}
        <DeleteIcon />
      {/snippet}
    </Button>
  </div>
{/snippet}

{#if documentsState.editTarget}
  <EditDocumentDialog
    document={documentsState.editTarget}
    pending={documentsState.saving}
    onSave={input => void documentsState.saveDocument(input)}
    onClose={() => documentsState.closeEdit()} />
{/if}

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
