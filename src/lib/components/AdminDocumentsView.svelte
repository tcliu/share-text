<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Copyable from './Copyable.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'

  interface Props {
    documentsState: ReturnType<typeof useAdminDocuments>
  }

  let { documentsState }: Props = $props()

  function formatTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  function formatSize(value: number) {
    return value.toLocaleString()
  }

  const columns: DataTableColumn<AdminDocumentSummary>[] = [
    {
      key: 'id',
      header: 'ID',
      widthClass: 'w-[15%]',
      sortable: true,
      searchable: true,
      cell: idCell,
    },
    {
      key: 'name',
      header: 'Name',
      widthClass: 'w-[25%]',
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: nameCell,
    },
    {
      key: 'documentType',
      header: 'Type',
      widthClass: 'w-[12%]',
      sortable: true,
      searchable: true,
      cell: documentTypeCell,
    },
    {
      key: 'length',
      header: 'Length',
      widthClass: 'w-[12%]',
      cellClass: 'text-slate-400',
      sortable: true,
      cell: lengthCell,
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      widthClass: 'w-[18%]',
      sortable: true,
      searchable: true,
      cell: updatedByCell,
    },
    {
      key: 'updatedAt',
      header: 'Updated time',
      widthClass: 'w-[18%]',
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
  onSort={(key, direction) => documentsState.handleSort(key, direction)} />

{#snippet idCell(document: AdminDocumentSummary)}
  <Copyable text={document.id} copyAriaLabel={`Copy document ID ${document.id}`}>
    <a
      href={`/${document.id}`}
      target="_blank"
      rel="noopener noreferrer"
      class="block font-mono text-xs text-slate-500 hover:text-cyan-300 hover:underline underline-offset-2">
      {document.id}
    </a>
  </Copyable>
{/snippet}

{#snippet nameCell(document: AdminDocumentSummary)}
  <EditableText
    text={document.name}
    size="sm"
    className="text-slate-200"
    onChange={name => void documentsState.rename(document.id, name)} />
{/snippet}

{#snippet documentTypeCell(document: AdminDocumentSummary)}
  <Copyable
    text={document.documentType}
    className="text-slate-400 capitalize"
    copyAriaLabel={`Copy document type ${document.documentType}`} />
{/snippet}

{#snippet lengthCell(document: AdminDocumentSummary)}
  {formatSize(document.contentSize)}
{/snippet}

{#snippet updatedByCell(document: AdminDocumentSummary)}
  <Copyable
    text={document.updatedBy}
    className="text-slate-400"
    copyAriaLabel={`Copy ${document.updatedBy}`} />
{/snippet}

{#snippet updatedAtCell(document: AdminDocumentSummary)}
  {formatTime(document.updatedAt)}
{/snippet}

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
