import { goto } from '$app/navigation'
import { toast } from 'svelte-sonner'
import { clearDraft } from './document-drafts'
import { t } from './i18n.svelte'
import { fetchOwnedDocuments, OwnedDocumentsAuthError } from './owned-documents'
import { useAdminDocumentsSearch } from './use-admin-documents-search.svelte'
import type { AdminDocumentSummary } from './admin'

export function useOwnedDocuments(onSignedOut: () => void) {
  let documents = $state<AdminDocumentSummary[]>([])
  let loaded = $state(false)
  let total = $state(0)
  let page = $state(1)
  let pageSize = $state(10)
  let loading = $state(false)
  let bulkDeletePending = $state(false)
  let bulkDeleteOpen = $state(false)
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
    documents.length > 0 && documents.every(document => selectedIds.has(document.id)),
  )
  const currentPageSomeSelected = $derived(documents.some(document => selectedIds.has(document.id)))

  function reset() {
    documents = []
    loaded = false
    total = 0
    page = 1
    pageSize = 10
    loading = false
    bulkDeletePending = false
    bulkDeleteOpen = false
    selectedIds = new Set()
    searchState.reset()
  }

  function handleAuthError(error: unknown) {
    if (error instanceof OwnedDocumentsAuthError) {
      onSignedOut()
      return true
    }
    return false
  }

  async function load() {
    loading = true
    try {
      const response = await fetchOwnedDocuments({
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
        toast.error(error instanceof Error ? error.message : t('admin.auth.toast.loadDocuments'))
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
      await Promise.all(
        ids.map(async id => {
          const response = await fetch(`/api/user/documents/${id}`, { method: 'DELETE' })
          if (response.status === 401) {
            throw new OwnedDocumentsAuthError()
          }
          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(typeof body.error === 'string' ? body.error : t('admin.auth.toast.deleteDocuments'))
          }
        }),
      )
      for (const id of ids) {
        clearDraft(id)
      }
      selectedIds = new Set()
      toast.success(
        ids.length === 1
          ? t('admin.documents.deleted', { count: ids.length })
          : t('admin.documents.deletedPlural', { count: ids.length }),
      )
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : t('admin.auth.toast.deleteDocuments'))
      }
    } finally {
      bulkDeletePending = false
    }
  }

  function openSelected() {
    if (selectedCount !== 1) {
      return
    }
    const id = [...selectedIds][0]
    void goto(`/${id}`)
  }

  async function rename(id: string, name: string) {
    const value = name.trim()
    if (!value) {
      return
    }
    try {
      const response = await fetch(`/api/user/documents/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: value }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        throw new OwnedDocumentsAuthError()
      }
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : t('admin.auth.toast.renameDocument'))
      }
      toast.success(t('admin.documents.renamed'))
      void load()
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : t('admin.auth.toast.renameDocument'))
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
    openSelected,
    rename,
  }
}
