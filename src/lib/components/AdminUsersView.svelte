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

  interface Props {
    usersState: ReturnType<typeof useAdminUsers>
  }

  let { usersState }: Props = $props()

  // Touch devices have no hover, so the inline copy/edit icons would be
  // permanently visible and noisy; show plain values instead (editing stays
  // available via the toolbar Edit button).
  const supportsHover = useSupportsHover()

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
  ]
</script>

<DataTable
  rows={usersState.users}
  rowId={user => String(user.id)}
  {columns}
  loading={usersState.loading}
  emptyMessage={usersState.searchQuery ? 'No users match your filter.' : 'No users yet.'}
  bind:searchValue={() => usersState.searchInput, value => (usersState.searchInput = value)}
  onSearchInput={() => usersState.handleSearchInput()}
  onSearchKeydown={event => usersState.handleSearchKeydown(event)}
  searchAriaLabel="Search all users"
  searchPlaceholder="Search users..."
  bind:searchKeys={() => usersState.searchKeys, keys => (usersState.searchKeys = keys)}
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
  {#if supportsHover}
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
  {#if supportsHover}
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
    {user.status === 'active' ? 'Active' : 'Inactive'}
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

{#if usersState.bulkDeleteOpen}
  <ConfirmDialog
    title={`Delete ${usersState.selectedCount} user${usersState.selectedCount === 1 ? '' : 's'}?`}
    message="The selected users will be deleted permanently. Their documents become anonymous and sharing entries are removed."
    confirmLabel="Delete"
    confirmColor="rose"
    onConfirm={() => void usersState.confirmBulkDelete()}
    onCancel={() => (usersState.bulkDeleteOpen = false)} />
{/if}
