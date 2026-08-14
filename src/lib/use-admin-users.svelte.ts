import { toast } from 'svelte-sonner'
import {
  AdminAuthError,
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUser,
  type AdminUser,
  type AdminUserStatus,
} from '$lib/admin'
import { useAdminDocumentsSearch } from '$lib/use-admin-documents-search.svelte'

export type UserDialogMode = 'add' | 'edit'

export interface UserDialogInput {
  username: string
  email: string
  password: string
  status: AdminUserStatus
}

export function useAdminUsers(params: { onSignedOut: () => void }) {
  const { onSignedOut } = params

  let users = $state<AdminUser[]>([])
  let loaded = $state(false)
  let total = $state(0)
  let page = $state(1)
  let pageSize = $state(10)
  let loading = $state(false)
  let deleteTarget = $state<AdminUser | null>(null)
  let deletingPending = $state(false)
  let dialogOpen = $state(false)
  let dialogMode = $state<UserDialogMode>('add')
  let dialogUser = $state<AdminUser | null>(null)
  let saving = $state(false)
  let bulkStatusOpen = $state(false)
  let bulkStatusPending = $state(false)
  let selectedIds = $state<Set<string>>(new Set())

  const searchState = useAdminDocumentsSearch({
    onParamsChange() {
      page = 1
      load().catch(() => {})
    },
  })

  $effect(() => {
    return () => searchState.destroy()
  })

  const selectedCount = $derived(selectedIds.size)
  const currentPageAllSelected = $derived(
    users.length > 0 && users.every(user => selectedIds.has(String(user.id))),
  )
  const currentPageSomeSelected = $derived(users.some(user => selectedIds.has(String(user.id))))

  function reset() {
    users = []
    loaded = false
    total = 0
    page = 1
    loading = false
    deleteTarget = null
    deletingPending = false
    dialogOpen = false
    dialogUser = null
    saving = false
    bulkStatusOpen = false
    bulkStatusPending = false
    selectedIds = new Set()
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
      const response = await fetchAdminUsers({
        search: searchState.searchQuery,
        searchKeys: searchState.searchKeys,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sortBy: searchState.sortBy,
        order: searchState.sortDir,
      })
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
        toast.error(error instanceof Error ? error.message : 'Failed to load users')
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
        await createAdminUser({
          username: input.username,
          email: input.email,
          password: input.password,
          status: input.status,
        })
        toast.success('User created')
      } else {
        const id = dialogUser?.id
        if (id === undefined) {
          return
        }
        await updateAdminUser(id, {
          username: input.username,
          email: input.email,
          password: input.password || undefined,
          status: input.status,
        })
        toast.success('User updated')
      }
      dialogOpen = false
      dialogUser = null
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to save user')
      }
    } finally {
      saving = false
    }
  }

  function toggleSelection(id: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
    selectedIds = next
  }

  function toggleAllOnCurrentPage() {
    if (currentPageAllSelected) {
      const next = new Set(selectedIds)
      for (const user of users) {
        next.delete(String(user.id))
      }
      selectedIds = next
    } else {
      const next = new Set(selectedIds)
      for (const user of users) {
        next.add(String(user.id))
      }
      selectedIds = next
    }
  }

  async function setBulkStatus(status: AdminUserStatus) {
    const ids = [...selectedIds]
    bulkStatusOpen = false
    if (ids.length === 0) {
      return
    }
    bulkStatusPending = true
    try {
      await Promise.all(ids.map(id => updateAdminUser(Number(id), { status })))
      toast.success(`${ids.length} user${ids.length === 1 ? '' : 's'} ${status === 'active' ? 'enabled' : 'disabled'}`)
      selectedIds = new Set()
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to update users')
      }
    } finally {
      bulkStatusPending = false
    }
  }

  async function updateUsername(id: number, username: string) {
    const value = username.trim()
    if (!value) {
      return
    }
    try {
      await updateAdminUser(id, { username: value })
      toast.success('Username updated')
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to update user')
      }
    }
  }

  async function updateEmail(id: number, email: string) {
    const value = email.trim()
    if (!value) {
      return
    }
    try {
      await updateAdminUser(id, { email: value })
      toast.success('Email updated')
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to update user')
      }
    }
  }

  async function confirmDelete() {
    const target = deleteTarget
    deleteTarget = null
    if (!target) {
      return
    }
    deletingPending = true
    try {
      await deleteAdminUser(target.id)
      const next = new Set(selectedIds)
      next.delete(String(target.id))
      selectedIds = next
      toast.success('User deleted')
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete user')
      }
    } finally {
      deletingPending = false
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
    get deleteTarget() {
      return deleteTarget
    },
    set deleteTarget(value: AdminUser | null) {
      deleteTarget = value
    },
    get deletingPending() {
      return deletingPending
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
    get selectedIds() {
      return selectedIds
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
    openEdit,
    closeDialog,
    saveUser,
    toggleSelection,
    toggleAllOnCurrentPage,
    setBulkStatus,
    updateUsername,
    updateEmail,
    confirmDelete,
  }
}
