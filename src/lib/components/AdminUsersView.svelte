<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import DataTable, { type DataTableColumn } from './DataTable.svelte'
  import EditableText from './EditableText.svelte'
  import UserDialog from './UserDialog.svelte'
  import Button from './Button.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import type { useAdminUsers } from '$lib/use-admin-users.svelte'
  import type { AdminUser } from '$lib/admin'
  import { formatTimestamp } from '$lib/date-format'

  interface Props {
    usersState: ReturnType<typeof useAdminUsers>
  }

  let { usersState }: Props = $props()

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '8%',
      minWidth: 72,
      sortable: true,
      cell: idCell,
    },
    {
      key: 'username',
      header: 'Username',
      width: '20%',
      minWidth: 144,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: usernameCell,
    },
    {
      key: 'email',
      header: 'Email',
      width: '28%',
      minWidth: 200,
      cellClass: 'max-w-0',
      sortable: true,
      searchable: true,
      cell: emailCell,
    },
    {
      key: 'status',
      header: 'Status',
      width: '14%',
      minWidth: 96,
      sortable: true,
      cell: statusCell,
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: '18%',
      minWidth: 144,
      cellClass: 'text-slate-500',
      sortable: true,
      cell: createdAtCell,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '12%',
      minWidth: 96,
      cell: actionsCell,
    },
  ]
</script>

<DataTable
  rows={usersState.users}
  rowId={user => String(user.id)}
  {columns}
  loading={usersState.loading}
  emptyMessage={usersState.searchQuery ? 'No users match your filter.' : 'No users yet.'}
  bind:searchValue={usersState.searchInput}
  onSearchInput={() => usersState.handleSearchInput()}
  onSearchKeydown={event => usersState.handleSearchKeydown(event)}
  searchAriaLabel="Search all users"
  searchPlaceholder="Search users..."
  bind:searchKeys={usersState.searchKeys}
  selectable
  selectedIds={usersState.selectedIds}
  onToggleSelection={(id, checked) => usersState.toggleSelection(id, checked)}
  onToggleAll={() => usersState.toggleAllOnCurrentPage()}
  allSelected={usersState.currentPageAllSelected}
  someSelected={usersState.currentPageSomeSelected}
  rowSelectAriaLabel={user => `Select user ${user.username}`}
  selectAllAriaLabel="Select all users"
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
  <span class="font-mono text-slate-500">{user.id}</span>
{/snippet}

{#snippet usernameCell(user: AdminUser)}
  <EditableText
    text={user.username}
    size="sm"
    className="text-slate-200"
    copyable
    onChange={username => void usersState.updateUsername(user.id, username)} />
{/snippet}

{#snippet emailCell(user: AdminUser)}
  <EditableText
    text={user.email}
    size="sm"
    className="text-slate-400"
    copyable
    onChange={email => void usersState.updateEmail(user.id, email)} />
{/snippet}

{#snippet statusCell(user: AdminUser)}
  <span
    class={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
      user.status === 'active'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        : 'border-slate-700 bg-slate-950 text-slate-400'
    }`}>
    {user.status === 'active' ? 'Active' : 'Inactive'}
  </span>
{/snippet}

{#snippet createdAtCell(user: AdminUser)}
  {formatTimestamp(user.createdAt)}
{/snippet}

{#snippet actionsCell(user: AdminUser)}
  <div class="flex items-center gap-1">
    <Button size="sm" ariaLabel={`Edit user ${user.username}`} tooltip="Edit" onClick={() => usersState.openEdit(user)}>
      {#snippet icon()}
        <EditIcon />
      {/snippet}
    </Button>
    <Button
      size="sm"
      ariaLabel={`Delete user ${user.username}`}
      tooltip="Delete"
      className="text-slate-400 hover:border-rose-500 hover:text-rose-300"
      onClick={() => (usersState.deleteTarget = user)}>
      {#snippet icon()}
        <DeleteIcon />
      {/snippet}
    </Button>
  </div>
{/snippet}

{#if usersState.dialogOpen}
  <UserDialog
    mode={usersState.dialogMode}
    user={usersState.dialogUser}
    pending={usersState.saving}
    onSave={input => void usersState.saveUser(input)}
    onClose={() => usersState.closeDialog()} />
{/if}

{#if usersState.bulkStatusOpen}
  <BaseDialog
    title="Set status"
    maxWidth="md"
    onCancel={() => (usersState.bulkStatusOpen = false)}
    pending={usersState.bulkStatusPending}>
    <div class="flex flex-col gap-4">
      <p class="text-sm text-slate-400">
        Set status for {usersState.selectedCount} selected user{usersState.selectedCount === 1 ? '' : 's'}:
      </p>
      <Buttons>
        {#snippet children()}
          <Button
            variant="primary"
            accent="emerald"
            pending={usersState.bulkStatusPending}
            onClick={() => void usersState.setBulkStatus('active')}>
            Set Active
          </Button>
          <Button
            variant="outline"
            accent="amber"
            pending={usersState.bulkStatusPending}
            onClick={() => void usersState.setBulkStatus('inactive')}>
            Set Inactive
          </Button>
          <Button onClick={() => (usersState.bulkStatusOpen = false)} disabled={usersState.bulkStatusPending}>
            Cancel
          </Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}

{#if usersState.deleteTarget}
  <ConfirmDialog
    title="Delete user?"
    message={`"${usersState.deleteTarget.username}" will be deleted permanently. Their documents become anonymous and sharing entries are removed.`}
    confirmLabel="Delete"
    confirmColor="rose"
    onConfirm={() => void usersState.confirmDelete()}
    onCancel={() => (usersState.deleteTarget = null)} />
{/if}
