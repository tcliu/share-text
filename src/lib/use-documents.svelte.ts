import { toast } from 'svelte-sonner'
import { goto } from '$app/navigation'
import type { OwnedDocumentSummary } from '$lib/documents'
import { DEFAULT_DOCUMENTS_PAGE_SIZE, deleteDocument, fetchDocumentSummaries } from '$lib/documents'
import { clearDraft } from '$lib/document-drafts'
import { t } from '$lib/i18n.svelte'

const DOCUMENT_SEARCH_KEYS = ['name', 'tags', 'id']

export interface UseDocumentsOptions {
  onDocumentDeleted?: (id: string) => void
  pageSize?: number
  initialDocuments?: OwnedDocumentSummary[]
  initialHasMore?: boolean
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const pageSize = options.pageSize ?? DEFAULT_DOCUMENTS_PAGE_SIZE

  let documents = $state<OwnedDocumentSummary[]>(options.initialDocuments ?? [])
  let loadingDocuments = $state(false)
  let documentsError = $state<string | null>(null)
  let hasMore = $state(options.initialHasMore ?? false)

  let creating = $state(false)

  let searchInput = $state('')
  let searchQuery = $state('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let listRequestId = 0

  function handleSearchInput() {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      searchQuery = searchInput.trim()
      void refreshList()
    }, 400)
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
      searchQuery = searchInput.trim()
      void refreshList()
    } else if (event.key === 'Escape') {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
      searchInput = ''
      searchQuery = ''
      void refreshList()
    }
  }

  $effect(() => {
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer)
        searchTimer = null
      }
    }
  })

  async function requestDocuments(offset: number, append: boolean) {
    const requestId = ++listRequestId
    loadingDocuments = true
    documentsError = null
    try {
      const response = await fetchDocumentSummaries({
        limit: pageSize,
        offset,
        search: searchQuery || undefined,
        searchKeys: DOCUMENT_SEARCH_KEYS,
      })
      if (requestId !== listRequestId) {
        return
      }
      documents = append ? [...documents, ...response.documents] : response.documents
      hasMore = response.hasMore
    } catch (error) {
      if (requestId !== listRequestId) {
        return
      }
      documentsError = error instanceof Error ? error.message : t('documents.toast.loadFailed')
    } finally {
      if (requestId === listRequestId) {
        loadingDocuments = false
      }
    }
  }

  function refreshList() {
    return requestDocuments(0, false)
  }

  function updateDocumentSummary(id: string, changes: Partial<OwnedDocumentSummary>) {
    documents = documents.map(document =>
      document.id === id ? { ...document, ...changes } : document,
    )
  }

  function loadMore() {
    if (!hasMore || loadingDocuments) return
    return requestDocuments(documents.length, true)
  }

  async function performCreate() {
    if (creating) return
    creating = true
    try {
      await goto('/new')
    } finally {
      creating = false
    }
  }

  async function performDelete(id: string) {
    try {
      await deleteDocument(id)
      clearDraft(id)
      toast.success(t('documents.toast.deleted'))
      await refreshList()
      options.onDocumentDeleted?.(id)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('documents.toast.deleteFailed'))
      return false
    }
  }

  return {
    get documents() {
      return documents
    },
    get loadingDocuments() {
      return loadingDocuments
    },
    get documentsError() {
      return documentsError
    },
    get hasMore() {
      return hasMore
    },
    get creating() {
      return creating
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
    refreshList,
    loadMore,
    updateDocumentSummary,
    performCreate,
    performDelete,
    handleSearchInput,
    handleSearchKeydown,
  }
}
