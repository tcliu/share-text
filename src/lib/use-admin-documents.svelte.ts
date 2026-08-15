import { toast } from 'svelte-sonner'
import {
  AdminAuthError,
  createAdminDocument,
  deleteAdminDocument,
  exportAdminDocuments,
  fetchAdminDocument,
  fetchAdminDocuments,
  importAdminDocuments,
  updateAdminDocument,
  type AdminDocumentSummary,
} from '$lib/admin'
import { downloadJson } from '$lib/download-json'
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
  let bulkDeletePending = $state(false)
  let bulkDeleteOpen = $state(false)
  let selectedIds = $state<Set<string>>(new Set())
  let dialogOpen = $state(false)
  let dialogMode = $state<'add' | 'edit'>('edit')
  let editTarget = $state<AdminDocumentSummary | null>(null)
  let editContent = $state('')
  let editContentLoading = $state(false)
  let editLoadToken = 0
  let saving = $state(false)
  let importOpen = $state(false)
  let importPending = $state(false)
  let exportPending = $state(false)

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
    bulkDeletePending = false
    bulkDeleteOpen = false
    selectedIds = new Set()
    dialogOpen = false
    dialogMode = 'edit'
    editTarget = null
    editContent = ''
    editContentLoading = false
    editLoadToken += 1
    saving = false
    importOpen = false
    importPending = false
    exportPending = false
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
      const imported = await importAdminDocuments(records)
      toast.success(`${imported.length} document${imported.length === 1 ? '' : 's'} imported`)
      importOpen = false
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to import documents')
      }
    } finally {
      importPending = false
    }
  }

  async function exportRecords() {
    exportPending = true
    try {
      const records = await exportAdminDocuments(selectedIds.size > 0 ? [...selectedIds] : undefined)
      downloadJson('documents-export.json', records)
      toast.success(`${records.length} document${records.length === 1 ? '' : 's'} exported`)
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to export documents')
      }
    } finally {
      exportPending = false
    }
  }

  function openAdd() {
    dialogMode = 'add'
    editTarget = null
    editContent = ''
    editContentLoading = false
    dialogOpen = true
  }

  function openEdit(document: AdminDocumentSummary) {
    dialogMode = 'edit'
    editLoadToken += 1
    editTarget = document
    editContent = ''
    editContentLoading = true
    dialogOpen = true
    void loadEditContent(document.id, editLoadToken)
  }

  async function loadEditContent(id: string, token: number) {
    try {
      const full = await fetchAdminDocument(id)
      if (token !== editLoadToken) {
        return
      }
      editContent = full.content
    } catch (error) {
      if (token !== editLoadToken) {
        return
      }
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to load document content')
      }
    } finally {
      if (token === editLoadToken) {
        editContentLoading = false
      }
    }
  }

  function closeEdit() {
    if (saving) {
      return
    }
    dialogOpen = false
    editTarget = null
    editContent = ''
  }

  async function saveDocument(input: {
    name: string
    documentType: string
    content: string
    key?: string
    createdBy?: string
    updatedBy?: string
  }) {
    saving = true
    try {
      if (dialogMode === 'add') {
        await createAdminDocument({
          name: input.name,
          content: input.content,
          documentType: input.documentType,
        })
        toast.success('Document created')
      } else {
        const target = editTarget
        if (!target) {
          return
        }
        await updateAdminDocument(target.id, {
          name: input.name,
          key: input.key,
          createdBy: input.createdBy,
          updatedBy: input.updatedBy,
          content: input.content,
          documentType: input.documentType,
        })
        toast.success('Document updated')
      }
      dialogOpen = false
      editTarget = null
      editContent = ''
      void load()
      onAdminChange()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(
          error instanceof Error ? error.message : `Failed to ${dialogMode === 'add' ? 'create' : 'update'} document`,
        )
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
    get bulkDeletePending() {
      return bulkDeletePending
    },
    get bulkDeleteOpen() {
      return bulkDeleteOpen
    },
    set bulkDeleteOpen(value: boolean) {
      bulkDeleteOpen = value
    },
    get dialogOpen() {
      return dialogOpen
    },
    get dialogMode() {
      return dialogMode
    },
    get editTarget() {
      return editTarget
    },
    get editContent() {
      return editContent
    },
    get editContentLoading() {
      return editContentLoading
    },
    get saving() {
      return saving
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
    openImport,
    closeImport,
    submitImport,
    exportRecords,
    openAdd,
    openEdit,
    closeEdit,
    saveDocument,
    updateKey,
    rename,
  }
}
