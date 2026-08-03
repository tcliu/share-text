import { toast } from 'svelte-sonner'
import {
  AdminAuthError,
  deleteAdminDocument,
  fetchAdminDocument,
  fetchAdminDocuments,
  renameAdminDocument,
  type AdminDocument,
  type AdminDocumentSummary,
} from '$lib/admin'

export function useAdminDocuments(params: {
  onSignedOut: () => void
  onAdminDelete: (id: string) => void
  onAdminChange: () => void
}) {
  const { onSignedOut, onAdminDelete, onAdminChange } = params
  let documents = $state<AdminDocumentSummary[]>([])
  let loaded = $state(false)
  let total = $state(0)
  let page = $state(1)
  let pageSize = $state(10)
  let searchQuery = $state('')
  let searchInput = $state('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let loading = $state(false)
  let viewingDocument = $state<AdminDocument | null>(null)
  let deleteTarget = $state<AdminDocumentSummary | null>(null)
  let deletingPending = $state(false)
  let bulkDeletePending = $state(false)
  let bulkDeleteOpen = $state(false)
  let selectedIds = $state<Set<string>>(new Set())
  let renamingId = $state<string | null>(null)
  let renameValue = $state('')
  let renamePending = $state(false)

  const selectedCount = $derived(selectedIds.size)
  const currentPageAllSelected = $derived(
    documents.length > 0 && documents.every(document => selectedIds.has(document.id)),
  )
  const currentPageSomeSelected = $derived(documents.some(document => selectedIds.has(document.id)))

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
        search: searchQuery,
        limit: pageSize,
        offset: (page - 1) * pageSize,
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

  function handleSearchInput() {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      searchQuery = searchInput.trim()
      page = 1
      void load()
    }, 400)
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
      searchQuery = searchInput.trim()
      page = 1
      void load()
    } else if (event.key === 'Escape') {
      searchInput = ''
      searchQuery = ''
      page = 1
      void load()
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

  async function viewDocument(summary: AdminDocumentSummary) {
    loading = true
    try {
      viewingDocument = await fetchAdminDocument(summary.id)
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to load document')
      }
    } finally {
      loading = false
    }
  }

  function backToList() {
    viewingDocument = null
  }

  function startRename(summary: AdminDocumentSummary) {
    renamingId = summary.id
    renameValue = summary.name
  }

  function cancelRename() {
    renamingId = null
    renameValue = ''
  }

  async function confirmRename() {
    const id = renamingId
    const name = renameValue.trim()
    if (!id || !name) {
      return
    }
    renamePending = true
    try {
      await renameAdminDocument(id, name)
      if (viewingDocument?.id === id) {
        viewingDocument = { ...viewingDocument, name }
      }
      renamingId = null
      renameValue = ''
      toast.success('Document renamed')
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to rename document')
      }
    } finally {
      renamePending = false
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
      if (viewingDocument?.id === target.id) {
        viewingDocument = null
      }
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

  function handleRenameSelected() {
    if (selectedCount !== 1) {
      return
    }
    const selected = documents.find(document => selectedIds.has(document.id))
    if (selected) {
      startRename(selected)
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
      return searchInput
    },
    set searchInput(value: string) {
      searchInput = value
    },
    get searchQuery() {
      return searchQuery
    },
    get loading() {
      return loading
    },
    get viewingDocument() {
      return viewingDocument
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
    get renamingId() {
      return renamingId
    },
    get renameValue() {
      return renameValue
    },
    set renameValue(value: string) {
      renameValue = value
    },
    get renamePending() {
      return renamePending
    },
    load,
    handleSearchInput,
    handleSearchKeydown,
    handlePageChange,
    handlePageSizeChange,
    toggleAllOnCurrentPage,
    toggleSelection,
    confirmBulkDelete,
    viewDocument,
    backToList,
    startRename,
    cancelRename,
    confirmRename,
    confirmDelete,
    handleRenameSelected,
  }
}
