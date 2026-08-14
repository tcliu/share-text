import { toast } from 'svelte-sonner'
import {
  AdminAuthError,
  deleteAdminDocument,
  fetchAdminDocuments,
  updateAdminDocument,
  type AdminDocumentSummary,
} from '$lib/admin'
import { useAdminDocumentsSearch } from '$lib/use-admin-documents-search.svelte'

export function useAdminDocuments(params: {
  onSignedOut: () => void
  onAdminDelete?: (id: string) => void
  onAdminChange?: () => void
}) {
  const { onSignedOut, onAdminDelete = () => {}, onAdminChange = () => {} } = params

  let documents = $state<AdminDocumentSummary[]>([])
  let loaded = $state(false)
  let total = $state(0)
  let page = $state(1)
  let pageSize = $state(10)
  let loading = $state(false)
  let deleteTarget = $state<AdminDocumentSummary | null>(null)
  let deletingPending = $state(false)
  let bulkDeletePending = $state(false)
  let bulkDeleteOpen = $state(false)
  let selectedIds = $state<Set<string>>(new Set())
  let editTarget = $state<AdminDocumentSummary | null>(null)
  let saving = $state(false)

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
    documents.length > 0 && documents.every(document => selectedIds.has(document.id)),
  )
  const currentPageSomeSelected = $derived(documents.some(document => selectedIds.has(document.id)))

  function reset() {
    documents = []
    loaded = false
    total = 0
    page = 1
    loading = false
    deleteTarget = null
    bulkDeletePending = false
    bulkDeleteOpen = false
    selectedIds = new Set()
    editTarget = null
    saving = false
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
      const response = await fetchAdminDocuments({
        search: searchState.searchQuery,
        searchKeys: searchState.searchKeys,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sortBy: searchState.sortBy,
        order: searchState.sortDir,
      })
      documents = response.documents
      total = response.total
      loaded = true
      if (documents.length === 0 && page > 1) {
        page = Math.max(1, page - 1)
        void load()
        return
      }
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to load documents')
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

  function toggleAllOnCurrentPage() {
    if (currentPageAllSelected) {
      const next = new Set(selectedIds)
      for (const document of documents) {
        next.delete(document.id)
      }
      selectedIds = next
    } else {
      const next = new Set(selectedIds)
      for (const document of documents) {
        next.add(document.id)
      }
      selectedIds = next
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

  async function confirmBulkDelete() {
    const ids = [...selectedIds]
    bulkDeleteOpen = false
    if (ids.length === 0) {
      return
    }
    bulkDeletePending = true
    try {
      await Promise.all(ids.map(id => deleteAdminDocument(id)))
      const next = new Set(selectedIds)
      for (const id of ids) {
        next.delete(id)
      }
      selectedIds = next
      toast.success(`${ids.length} document${ids.length === 1 ? '' : 's'} deleted`)
      void load()
      for (const id of ids) {
        onAdminDelete(id)
      }
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete documents')
      }
    } finally {
      bulkDeletePending = false
    }
  }

  function openEdit(document: AdminDocumentSummary) {
    editTarget = document
  }

  function closeEdit() {
    if (saving) {
      return
    }
    editTarget = null
  }

  async function saveDocument(input: {
    name: string
    key: string
    createdBy: string
    updatedBy: string
  }) {
    const target = editTarget
    if (!target) {
      return
    }
    saving = true
    try {
      await updateAdminDocument(target.id, {
        name: input.name,
        key: input.key,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
      })
      toast.success('Document updated')
      editTarget = null
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to update document')
      }
    } finally {
      saving = false
    }
  }

  async function updateKey(id: string, key: string) {
    const value = key.trim().toLowerCase()
    if (!value) {
      return
    }
    try {
      await updateAdminDocument(id, { key: value })
      toast.success('Document ID updated')
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to update document')
      }
    }
  }

  async function rename(id: string, name: string) {
    const value = name.trim()
    if (!value) {
      return
    }
    try {
      await updateAdminDocument(id, { name: value })
      toast.success('Document renamed')
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to rename document')
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
      await deleteAdminDocument(target.id)
      const next = new Set(selectedIds)
      next.delete(target.id)
      selectedIds = next
      toast.success('Document deleted')
      void load()
      onAdminDelete(target.id)
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete document')
      }
    } finally {
      deletingPending = false
    }
  }

  return {
    get documents() {
      return documents
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
    set deleteTarget(value: AdminDocumentSummary | null) {
      deleteTarget = value
    },
    get deletingPending() {
      return deletingPending
    },
    get bulkDeletePending() {
      return bulkDeletePending
    },
    get bulkDeleteOpen() {
      return bulkDeleteOpen
    },
    set bulkDeleteOpen(value: boolean) {
      bulkDeleteOpen = value
    },
    get editTarget() {
      return editTarget
    },
    get saving() {
      return saving
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
    toggleAllOnCurrentPage,
    toggleSelection,
    confirmBulkDelete,
    openEdit,
    closeEdit,
    saveDocument,
    updateKey,
    rename,
    confirmDelete,
  }
}
