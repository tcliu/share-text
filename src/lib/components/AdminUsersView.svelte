<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import UserDialog from './UserDialog.svelte'
  import ImportDialog from './ImportDialog.svelte'
  import Button from './Button.svelte'
  import type { useAdminUsers } from '$lib/use-admin-users.svelte'
  import type { AdminUser } from '$lib/admin'
  import { formatTimestamp } from '$lib/date-format'
  import PlainCell from './PlainCell.svelte'
  import { useSupportsHover } from '$lib/use-supports-hover.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    usersState: ReturnType<typeof useAdminUsers>
  }

  let { usersState }: Props = $props()

  // Touch devices have no hover, so the inline copy/edit icons would be
  // permanently visible and noisy; show plain values instead (editing stays
  // available via the toolbar Edit button).
  const supportsHover = useSupportsHover()

  const columns = $derived.by<DataTableColumn<AdminUser>[]>(() => [
    {
      key: 'id',
      header: i18n.t('admin.users.id'),
      width: '8%',
      minWidth: 72,
      sortable: true,
      cell: idCell,
    },
    {
      key: 'username',
      header: i18n.t('admin.users.username'),
      width: '20%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: usernameCell,
    },
    {
      key: 'email',
      header: i18n.t('admin.users.email'),
      width: '28%',
      minWidth: 200,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: emailCell,
    },
    {
      key: 'status',
      header: i18n.t('admin.users.status'),
      width: '14%',
      minWidth: 96,
      sortable: true,
      cell: statusCell,
    },
    {
      key: 'createdAt',
      header: i18n.t('admin.users.created'),
      width: '18%',
      minWidth: 144,
      cellClass: 'text-slate-400',
      sortable: true,
      cell: createdAtCell,
    },
  ])
</script>

<DataTable
  rows={usersState.users}
  rowId={user => String(user.id)}
  {columns}
  loading={usersState.loading}
  emptyMessage={usersState.searchQuery ? i18n.t('admin.users.noMatches') : i18n.t('admin.users.empty')}
  bind:searchValue={() => usersState.searchInput, value => (usersState.searchInput = value)}
  onSearchInput={() => usersState.handleSearchInput()}
  onSearchKeydown={event => usersState.handleSearchKeydown(event)}
  searchAriaLabel={i18n.t('admin.users.searchAria')}
  searchPlaceholder={i18n.t('admin.users.searchPlaceholder')}
  bind:searchKeys={() => usersState.searchKeys, keys => (usersState.searchKeys = keys)}
  selectable
  selectedIds={usersState.selectedIds}
  onToggleSelection={(id, checked) => usersState.toggleSelection(id, checked)}
  onToggleAll={() => usersState.toggleAllOnCurrentPage()}
  allSelected={usersState.currentPageAllSelected}
  someSelected={usersState.currentPageSomeSelected}
  rowSelectAriaLabel={user => i18n.t('admin.selectUser', { name: user.username })}
  selectAllAriaLabel={i18n.t('admin.users.selectAll')}
  total={usersState.total}
  pageSize={usersState.pageSize}
  currentPage={usersState.page}
  onPageChange={nextPage => usersState.handlePageChange(nextPage)}
  onPageSizeChange={size => usersState.handlePageSizeChange(size)}
  sortKey={usersState.sortBy}
  sortDirection={usersState.sortDir}
  onSort={(key, direction) => usersState.handleSort(key, direction)}
  fillHeight
  resizable
  storageKey="admin-users" />

{#snippet idCell(user: AdminUser)}
  <span class="font-mono text-slate-400">{user.id}</span>
{/snippet}

{#snippet usernameCell(user: AdminUser)}
  {#if supportsHover.value}
    <EditableText
      text={user.username}
      size="sm"
      className="text-slate-200"
      copyable
      onChange={username => void usersState.updateUsername(user.id, username)} />
  {:else}
    <PlainCell value={user.username} className="text-slate-200" />
  {/if}
{/snippet}

{#snippet emailCell(user: AdminUser)}
  {#if supportsHover.value}
    <EditableText
      text={user.email}
      size="sm"
      className="text-slate-400"
      copyable
      onChange={email => void usersState.updateEmail(user.id, email)} />
  {:else}
    <PlainCell value={user.email} className="text-slate-400" />
  {/if}
{/snippet}

{#snippet statusCell(user: AdminUser)}
  <span
    class={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
      user.status === 'active'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        : 'border-slate-700 bg-slate-950 text-slate-400'
    }`}>
    {user.status === 'active' ? i18n.t('admin.active') : i18n.t('admin.inactive')}
  </span>
{/snippet}

{#snippet createdAtCell(user: AdminUser)}
  {formatTimestamp(user.createdAt)}
{/snippet}

{#if usersState.dialogOpen}
  <UserDialog
    mode={usersState.dialogMode}
    user={usersState.dialogUser}
    pending={usersState.saving}
    onSave={input => void usersState.saveUser(input)}
    onClose={() => usersState.closeDialog()} />
{/if}

{#if usersState.importOpen}
  <ImportDialog
    kind="users"
    pending={usersState.importPending}
    onImport={records => void usersState.submitImport(records)}
    onClose={() => usersState.closeImport()} />
{/if}

{#if usersState.bulkStatusOpen}
  <BaseDialog
    title={i18n.t('admin.users.setStatus')}
    maxWidth="md"
    onCancel={() => (usersState.bulkStatusOpen = false)}
    pending={usersState.bulkStatusPending}>
    <div class="flex flex-col gap-4">
      <p class="text-sm text-slate-400">
        {usersState.selectedCount === 1
          ? i18n.t('admin.users.setStatusFor', { count: usersState.selectedCount })
          : i18n.t('admin.users.setStatusForPlural', { count: usersState.selectedCount })}
      </p>
      <Buttons align="right">
        {#snippet children()}
          <Button
            variant="primary"
            accent="emerald"
            pending={usersState.bulkStatusPending}
            onClick={() => void usersState.setBulkStatus('active')}>
            {i18n.t('admin.users.setActive')}
          </Button>
          <Button
            variant="outline"
            accent="amber"
            pending={usersState.bulkStatusPending}
            onClick={() => void usersState.setBulkStatus('inactive')}>
            {i18n.t('admin.users.setInactive')}
          </Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}

{#if usersState.bulkDeleteOpen}
  <ConfirmDialog
    title={usersState.selectedCount === 1
      ? i18n.t('admin.deleteUsersTitle', { count: usersState.selectedCount })
      : i18n.t('admin.deleteUsersTitlePlural', { count: usersState.selectedCount })}
    message={i18n.t('admin.deleteUsersMessage')}
    confirmLabel={i18n.t('common.delete')}
    confirmColor="rose"
    onConfirm={() => void usersState.confirmBulkDelete()}
    onCancel={() => (usersState.bulkDeleteOpen = false)} />
{/if}
