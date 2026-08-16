<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Copyable from './Copyable.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import EditDocumentDialog from './EditDocumentDialog.svelte'
  import ImportDialog from './ImportDialog.svelte'
  import Button from './Button.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import type { useAdminDocuments } from '$lib/use-admin-documents.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'
  import Chip from './Chip.svelte'
  import PlainCell from './PlainCell.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'
  import { formatTimestamp } from '$lib/date-format'
  import type { Tag } from '$lib/tag-colors'
  import { useSupportsHover } from '$lib/use-supports-hover.svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    documentsState: ReturnType<typeof useAdminDocuments>
  }

  let { documentsState }: Props = $props()

  // Touch devices have no hover, so the inline copy/edit icons would be
  // permanently visible and noisy; show plain values instead (editing stays
  // available via the row Edit button).
  const supportsHover = useSupportsHover()

  function formatSize(value: number) {
    return value.toLocaleString()
  }

  function formatTags(tags: Tag[] | undefined) {
    return tags?.map(tag => tag.name).join(', ') ?? ''
  }

  const columns = $derived.by<DataTableColumn<AdminDocumentSummary>[]>(() => [
    {
      key: 'id',
      header: t('admin.documents.key'),
      width: '10%',
      minWidth: 160,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: idCell,
    },
    {
      key: 'name',
      header: t('admin.documents.name'),
      width: '17%',
      minWidth: 160,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: nameCell,
    },
    {
      key: 'documentType',
      header: t('admin.documents.type'),
      width: '9%',
      sortable: true,
      searchable: true,
      cell: documentTypeCell,
    },
    {
      key: 'tags',
      header: t('editor.tags'),
      width: '14%',
      cellClass: 'max-w-0',
      searchable: true,
      cell: tagsCell,
    },
    {
      key: 'length',
      header: t('admin.documents.length'),
      width: '8%',
      cellClass: 'text-slate-400',
      sortable: true,
      cell: lengthCell,
    },
    {
      key: 'createdBy',
      header: t('admin.documents.createdBy'),
      width: '12%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: createdByCell,
    },
    {
      key: 'updatedBy',
      header: t('admin.documents.updatedBy'),
      width: '12%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: updatedByCell,
    },
    {
      key: 'access',
      header: t('admin.documents.access'),
      width: '8%',
      minWidth: 96,
      cell: accessCell,
    },
    {
      key: 'updatedAt',
      header: t('admin.documents.updatedTime'),
      width: '12%',
      minWidth: 144,
      cellClass: 'text-slate-400',
      sortable: true,
      cell: updatedAtCell,
    },
    {
      key: 'actions',
      header: t('admin.documents.actions'),
      width: '8%',
      minWidth: 96,
      cell: actionsCell,
    },
  ])
</script>

<DataTable
  rows={documentsState.documents}
  rowId={document => document.id}
  {columns}
  loading={documentsState.loading}
  emptyMessage={documentsState.searchQuery ? t('admin.documents.noMatches') : t('admin.documents.empty')}
  bind:searchValue={() => documentsState.searchInput, value => (documentsState.searchInput = value)}
  onSearchInput={() => documentsState.handleSearchInput()}
  onSearchKeydown={event => documentsState.handleSearchKeydown(event)}
  searchAriaLabel={t('admin.documents.searchAria')}
  searchPlaceholder={t('list.searchDocumentsPlaceholder')}
  bind:searchKeys={() => documentsState.searchKeys, keys => (documentsState.searchKeys = keys)}
  selectable
  selectedIds={documentsState.selectedIds}
  onToggleSelection={(id, checked) => documentsState.toggleSelection(id, checked)}
  onToggleAll={() => documentsState.toggleAllOnCurrentPage()}
  allSelected={documentsState.currentPageAllSelected}
  someSelected={documentsState.currentPageSomeSelected}
  rowSelectAriaLabel={document => t('admin.selectDocument', { name: document.name })}
  selectAllAriaLabel={t('admin.documents.selectAll')}
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
  {#if supportsHover}
    <EditableText
      text={document.id}
      size="sm"
      className="font-mono text-slate-400 transition-colors hover:text-cyan-300"
      copyable
      onActivate={() => window.open(`/${document.id}`, '_blank', 'noopener')}
      onChange={key => void documentsState.updateKey(document.id, key)} />
  {:else}
    <PlainCell value={document.id} className="font-mono text-slate-400" />
  {/if}
{/snippet}

{#snippet nameCell(document: AdminDocumentSummary)}
  {#if supportsHover}
    <EditableText
      text={document.name}
      size="sm"
      className="text-slate-200"
      copyable
      onChange={name => void documentsState.rename(document.id, name)} />
  {:else}
    <PlainCell value={document.name} className="text-slate-200" />
  {/if}
{/snippet}

{#snippet documentTypeCell(document: AdminDocumentSummary)}
  {#if supportsHover}
    <Copyable
      text={document.documentType}
      className="text-slate-400 capitalize"
      copyAriaLabel={t('admin.copyDocumentType', { name: document.documentType })} />
  {:else}
    <PlainCell value={document.documentType} className="capitalize text-slate-400" />
  {/if}
{/snippet}

{#snippet tagsChips(document: AdminDocumentSummary)}
  <span class="flex flex-wrap gap-1">
    {#each document.tags as tag (tag.name)}
      <Chip label={tag.name} chipClass={tagChipClass()} style={tagChipStyle(tag.color)} />
    {/each}
  </span>
{/snippet}

{#snippet tagsCell(document: AdminDocumentSummary)}
  {#if (document.tags ?? []).length > 0}
    {#if supportsHover}
      <Copyable
        text={formatTags(document.tags)}
        className="block text-slate-400"
        copyAriaLabel={t('admin.copyTagsFor', { name: document.name })}>
        {@render tagsChips(document)}
      </Copyable>
    {:else}
      {@render tagsChips(document)}
    {/if}
  {/if}
{/snippet}

{#snippet lengthCell(document: AdminDocumentSummary)}
  {formatSize(document.contentSize)}
{/snippet}

{#snippet createdByCell(document: AdminDocumentSummary)}
  {#if supportsHover}
    <Copyable
      text={document.createdBy}
      className="block truncate text-slate-400"
      copyAriaLabel={t('admin.copyCreatedBy', { name: document.createdBy })} />
  {:else}
    <PlainCell value={document.createdBy} className="text-slate-400" />
  {/if}
{/snippet}

{#snippet updatedByCell(document: AdminDocumentSummary)}
  {#if supportsHover}
    <Copyable
      text={document.updatedBy}
      className="block truncate text-slate-400"
      copyAriaLabel={t('admin.copyUpdatedBy', { name: document.updatedBy })} />
  {:else}
    <PlainCell value={document.updatedBy} className="text-slate-400" />
  {/if}
{/snippet}

{#snippet accessCell(document: AdminDocumentSummary)}
  <span
    class={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
      document.isPublic
        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-700 bg-slate-950 text-slate-400'
    }`}>
    {document.isPublic ? t('common.public') : t('list.private')}
  </span>
{/snippet}

{#snippet updatedAtCell(document: AdminDocumentSummary)}
  {formatTimestamp(document.updatedAt)}
{/snippet}

{#snippet actionsCell(document: AdminDocumentSummary)}
  <div class="flex items-center gap-1">
    <Button
      size="sm"
      ariaLabel={t('admin.editDocument', { name: document.name })}
      tooltip={t('common.edit')}
      onClick={() => documentsState.openEdit(document)}>
      {#snippet icon()}
        <EditIcon />
      {/snippet}
    </Button>
  </div>
{/snippet}

{#if documentsState.dialogOpen}
  <EditDocumentDialog
    mode={documentsState.dialogMode}
    document={documentsState.editTarget}
    content={documentsState.editContent}
    contentLoading={documentsState.editContentLoading}
    pending={documentsState.saving}
    onSave={input => void documentsState.saveDocument(input)}
    onClose={() => documentsState.closeEdit()} />
{/if}

{#if documentsState.importOpen}
  <ImportDialog
    kind="documents"
    pending={documentsState.importPending}
    onImport={records => void documentsState.submitImport(records)}
    onClose={() => documentsState.closeImport()} />
{/if}

{#if documentsState.bulkDeleteOpen}
  <ConfirmDialog
    title={documentsState.selectedCount === 1
      ? t('admin.deleteDocumentsTitle', { count: documentsState.selectedCount })
      : t('admin.deleteDocumentsTitlePlural', { count: documentsState.selectedCount })}
    message={t('admin.deleteDocumentsMessage')}
    confirmLabel={t('common.delete')}
    confirmColor="rose"
    onConfirm={() => void documentsState.confirmBulkDelete()}
    onCancel={() => (documentsState.bulkDeleteOpen = false)} />
{/if}
