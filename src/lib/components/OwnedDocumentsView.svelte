<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Copyable from './Copyable.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import type { useOwnedDocuments } from '$lib/use-owned-documents.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'
  import Chip from './Chip.svelte'
  import PlainCell from './PlainCell.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'
  import { formatTimestamp } from '$lib/date-format'
  import type { Tag } from '$lib/tag-colors'
  import { useSupportsHover } from '$lib/use-supports-hover.svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    documentsState: ReturnType<typeof useOwnedDocuments>
  }

  let { documentsState }: Props = $props()

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
      width: '14%',
      minWidth: 160,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: idCell,
    },
    {
      key: 'name',
      header: t('admin.documents.name'),
      width: '22%',
      minWidth: 180,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: nameCell,
    },
    {
      key: 'documentType',
      header: t('admin.documents.type'),
      width: '10%',
      sortable: true,
      searchable: true,
      cell: documentTypeCell,
    },
    {
      key: 'tags',
      header: t('editor.tags'),
      width: '18%',
      cellClass: 'max-w-0',
      searchable: true,
      cell: tagsCell,
    },
    {
      key: 'length',
      header: t('admin.documents.length'),
      width: '10%',
      cellClass: 'text-slate-400',
      sortable: true,
      cell: lengthCell,
    },
    {
      key: 'access',
      header: t('admin.documents.access'),
      width: '10%',
      minWidth: 96,
      cell: accessCell,
    },
    {
      key: 'updatedAt',
      header: t('admin.documents.updatedTime'),
      width: '16%',
      minWidth: 144,
      cellClass: 'text-slate-400',
      sortable: true,
      cell: updatedAtCell,
    },
  ])
</script>

<DataTable
  rows={documentsState.documents}
  rowId={document => document.id}
  {columns}
  loading={documentsState.loading}
  emptyMessage={documentsState.searchInput ? t('admin.documents.noMatches') : t('admin.documents.empty')}
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
  storageKey="settings-documents" />

{#snippet idCell(document: AdminDocumentSummary)}
  {#if supportsHover.value}
    <Copyable text={document.id} className="font-mono text-slate-400" copyAriaLabel={t('admin.copyDocumentKey', { id: document.id })}>
      <a
        href={`/${document.id}`}
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-slate-400 outline-none transition hover:text-cyan-300 focus:text-cyan-300">
        {document.id}
      </a>
    </Copyable>
  {:else}
    <PlainCell value={document.id} className="font-mono text-slate-400" />
  {/if}
{/snippet}

{#snippet nameCell(document: AdminDocumentSummary)}
  {#if supportsHover.value}
    <EditableText
      text={document.name}
      size="sm"
      className="text-slate-200"
      copyable
      onActivate={() => window.open(`/${document.id}`, '_blank', 'noopener')}
      onChange={name => void documentsState.rename(document.id, name)} />
  {:else}
    <PlainCell value={document.name} className="text-slate-200" />
  {/if}
{/snippet}

{#snippet documentTypeCell(document: AdminDocumentSummary)}
  {#if supportsHover.value}
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
    {#if supportsHover.value}
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
