import { toast } from 'svelte-sonner'
import {
  AdminAuthError,
  createAdminUser,
  deleteAdminUser,
  exportAdminUsers,
  fetchAdminUsers,
  importAdminUsers,
  updateAdminUser,
  type AdminUser,
  type AdminUserStatus,
} from '#lib/admin.js'
import { downloadJson } from '#lib/download-json.js'
import { useAdminDocumentsSearch } from '#lib/use-admin-documents-search.svelte.js'
import { createPageSelection } from '#lib/use-page-selection.svelte.js'
import { getI18nContext } from '#lib/i18n.svelte.js'

export type UserDialogMode = 'add' | 'edit'

export interface UserDialogInput {
  username: string
  email: string
  password: string
  status: AdminUserStatus
}

export function useAdminUsers(params: { onSignedOut: () => void }) {
  const i18n = getI18nContext()
  const { onSignedOut } = params

  let users = $state<AdminUser[]>([])
  let loaded = $state(false)
  let total = $state(0)
  let page = $state(1)
  let pageSize = $state(10)
  let loading = $state(false)
  let dialogOpen = $state(false)
  let dialogMode = $state<UserDialogMode>('add')
  let dialogUser = $state<AdminUser | null>(null)
  let saving = $state(false)
  let bulkStatusOpen = $state(false)
  let bulkStatusPending = $state(false)
  let bulkDeleteOpen = $state(false)
  let bulkDeletePending = $state(false)
  let importOpen = $state(false)
  let importPending = $state(false)
  let exportPending = $state(false)
  const selection = createPageSelection(() => users.map(user => String(user.id)))

  const searchState = useAdminDocumentsSearch({
    onParamsChange() {
      page = 1
      load().catch(() => {})
    },
  })

  $effect(() => {
    return () => searchState.destroy()
  })

  const selectedCount = $derived(selection.selectedCount)
  const currentPageAllSelected = $derived(selection.currentPageAllSelected)
  const currentPageSomeSelected = $derived(selection.currentPageSomeSelected)

  function reset() {
    users = []
    loaded = false
    total = 0
    page = 1
    loading = false
    dialogOpen = false
    dialogUser = null
    saving = false
    bulkStatusOpen = false
    bulkStatusPending = false
    bulkDeleteOpen = false
    bulkDeletePending = false
    importOpen = false
    importPending = false
    exportPending = false
    selection.reset()
    searchState.reset()
  }

  function handleAuthError(error: unknown) {
    if (error instanceof AdminAuthError) {
      onSignedOut()
      return true
    }
    return false
  }

  async function load() {
    loading = true
    try {
      const response = await fetchAdminUsers(
        {
          search: searchState.searchQuery,
          searchKeys: searchState.searchKeys,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          sortBy: searchState.sortBy,
          order: searchState.sortDir,
        },
        i18n,
      )
      users = response.users
      total = response.total
      loaded = true
      if (users.length === 0 && page > 1) {
        page = Math.max(1, page - 1)
        void load()
        return
      }
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.loadUsers'))
      }
    } finally {
      loading = false
    }
  }

  function handlePageChange(nextPage: number) {
    page = nextPage
    void load()
  }

  function handlePageSizeChange(size: number) {
    pageSize = size
    page = 1
    void load()
  }

  function openAdd() {
    dialogMode = 'add'
    dialogUser = null
    dialogOpen = true
  }

  function openImport() {
    importOpen = true
  }

  function closeImport() {
    if (importPending) {
      return
    }
    importOpen = false
  }

  async function submitImport(records: unknown[]) {
    importPending = true
    try {
      const imported = await importAdminUsers(records, i18n)
      toast.success(
        imported.length === 1
          ? i18n.t('admin.users.imported', { count: imported.length })
          : i18n.t('admin.users.importedPlural', { count: imported.length }),
      )
      importOpen = false
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.importUsers'))
      }
    } finally {
      importPending = false
    }
  }

  async function exportRecords() {
    exportPending = true
    try {
      const records = await exportAdminUsers(
        selection.selectedIds.size > 0 ? [...selection.selectedIds].map(Number) : undefined,
        i18n,
      )
      downloadJson('users-export.json', records)
      toast.success(
        records.length === 1
          ? i18n.t('admin.users.exported', { count: records.length })
          : i18n.t('admin.users.exportedPlural', { count: records.length }),
      )
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.exportUsers'))
      }
    } finally {
      exportPending = false
    }
  }

  function openEdit(user: AdminUser) {
    dialogMode = 'edit'
    dialogUser = user
    dialogOpen = true
  }

  function closeDialog() {
    if (saving) {
      return
    }
    dialogOpen = false
    dialogUser = null
  }

  async function saveUser(input: UserDialogInput) {
    saving = true
    try {
      if (dialogMode === 'add') {
        await createAdminUser(
          {
            username: input.username,
            email: input.email,
            password: input.password,
            status: input.status,
          },
          i18n,
        )
        toast.success(i18n.t('admin.users.userCreated'))
      } else {
        const id = dialogUser?.id
        if (id === undefined) {
          return
        }
        await updateAdminUser(
          id,
          {
            username: input.username,
            email: input.email,
            password: input.password || undefined,
            status: input.status,
          },
          i18n,
        )
        toast.success(i18n.t('admin.users.updated'))
      }
      dialogOpen = false
      dialogUser = null
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.saveUser'))
      }
    } finally {
      saving = false
    }
  }

  function toggleSelection(id: string, checked: boolean) {
    selection.toggleSelection(id, checked)
  }

  function toggleAllOnCurrentPage() {
    selection.toggleAllOnCurrentPage()
  }

  async function setBulkStatus(status: AdminUserStatus) {
    const ids = [...selection.selectedIds]
    bulkStatusOpen = false
    if (ids.length === 0) {
      return
    }
    bulkStatusPending = true
    try {
      await Promise.all(ids.map(id => updateAdminUser(Number(id), { status }, i18n)))
      toast.success(
        i18n.t(ids.length === 1 ? 'admin.users.statusUpdated' : 'admin.users.statusUpdatedPlural', {
          count: ids.length,
          state: status === 'active' ? i18n.t('admin.enabled') : i18n.t('admin.disabled'),
        }),
      )
      selection.clear()
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.updateUsers'))
      }
    } finally {
      bulkStatusPending = false
    }
  }

  // The toolbar Edit button is context-sensitive: a single selection opens the
  // edit dialog for that user; multiple selections open the batch status
  // dialog. The button is disabled with no selection.
  function handleToolbarEdit() {
    if (selectedCount === 1) {
      const id = [...selection.selectedIds][0]
      const user = users.find(u => String(u.id) === id)
      if (user) {
        openEdit(user)
        return
      }
    }
    if (selectedCount === 0) {
      return
    }
    bulkStatusOpen = true
  }

  async function updateUsername(id: number, username: string) {
    const value = username.trim()
    if (!value) {
      return
    }
    try {
      await updateAdminUser(id, { username: value }, i18n)
      toast.success(i18n.t('admin.users.usernameUpdated'))
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.updateUser'))
      }
    }
  }

  async function updateEmail(id: number, email: string) {
    const value = email.trim()
    if (!value) {
      return
    }
    try {
      await updateAdminUser(id, { email: value }, i18n)
      toast.success(i18n.t('admin.users.emailUpdated'))
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.updateUser'))
      }
    }
  }

  async function confirmBulkDelete() {
    const ids = [...selection.selectedIds]
    bulkDeleteOpen = false
    if (ids.length === 0) {
      return
    }
    bulkDeletePending = true
    try {
      await Promise.all(ids.map(id => deleteAdminUser(Number(id), i18n)))
      selection.remove(ids)
      toast.success(
        ids.length === 1
          ? i18n.t('admin.users.deleted', { count: ids.length })
          : i18n.t('admin.users.deletedPlural', { count: ids.length }),
      )
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.deleteUsers'))
      }
    } finally {
      bulkDeletePending = false
    }
  }

  return {
    get users() {
      return users
    },
    get loaded() {
      return loaded
    },
    get total() {
      return total
    },
    get page() {
      return page
    },
    get pageSize() {
      return pageSize
    },
    get searchInput() {
      return searchState.searchInput
    },
    set searchInput(value: string) {
      searchState.searchInput = value
    },
    get searchQuery() {
      return searchState.searchQuery
    },
    get searchKeys() {
      return searchState.searchKeys
    },
    set searchKeys(value: string[]) {
      searchState.searchKeys = value
    },
    get sortBy() {
      return searchState.sortBy
    },
    get sortDir() {
      return searchState.sortDir
    },
    get loading() {
      return loading
    },
    get dialogOpen() {
      return dialogOpen
    },
    get dialogMode() {
      return dialogMode
    },
    get dialogUser() {
      return dialogUser
    },
    get saving() {
      return saving
    },
    get bulkStatusOpen() {
      return bulkStatusOpen
    },
    set bulkStatusOpen(value: boolean) {
      bulkStatusOpen = value
    },
    get bulkStatusPending() {
      return bulkStatusPending
    },
    get bulkDeleteOpen() {
      return bulkDeleteOpen
    },
    set bulkDeleteOpen(value: boolean) {
      bulkDeleteOpen = value
    },
    get bulkDeletePending() {
      return bulkDeletePending
    },
    get importOpen() {
      return importOpen
    },
    get importPending() {
      return importPending
    },
    get exportPending() {
      return exportPending
    },
    get selectedIds() {
      return selection.selectedIds
    },
    get selectedCount() {
      return selectedCount
    },
    get currentPageAllSelected() {
      return currentPageAllSelected
    },
    get currentPageSomeSelected() {
      return currentPageSomeSelected
    },
    load,
    handleSearchInput: searchState.handleSearchInput,
    handleSearchKeydown: searchState.handleSearchKeydown,
    handlePageChange,
    handlePageSizeChange,
    handleSort: searchState.handleSort,
    reset,
    openAdd,
    openImport,
    closeImport,
    submitImport,
    exportRecords,
    openEdit,
    closeDialog,
    saveUser,
    toggleSelection,
    toggleAllOnCurrentPage,
    setBulkStatus,
    handleToolbarEdit,
    confirmBulkDelete,
    updateUsername,
    updateEmail,
  }
}
