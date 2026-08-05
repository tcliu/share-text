import { toast } from 'svelte-sonner'
import { goto } from '$app/navigation'
import type { DocumentSummary } from '$lib/documents'
import { createDocument, deleteDocument, fetchDocumentSummaries } from '$lib/documents'
import { clearDraft } from '$lib/document-drafts'

export const DEFAULT_DOCUMENTS_PAGE_SIZE = 20

export interface UseDocumentsOptions {
  onDocumentDeleted?: (id: string) => void
  pageSize?: number
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const pageSize = options.pageSize ?? DEFAULT_DOCUMENTS_PAGE_SIZE

  let documents = $state<DocumentSummary[]>([])
  let loadingDocuments = $state(false)
  let documentsError = $state<string | null>(null)
  let hasMore = $state(false)

  let creating = $state(false)

  async function refreshList() {
    loadingDocuments = true
    documentsError = null
    try {
      const response = await fetchDocumentSummaries({ limit: pageSize, offset: 0 })
      documents = response.documents
      hasMore = response.hasMore
    } catch (error) {
      documentsError = error instanceof Error ? error.message : 'Failed to load documents'
    } finally {
      loadingDocuments = false
    }
  }

  async function loadMore() {
    if (!hasMore || loadingDocuments) return

    loadingDocuments = true
    documentsError = null
    try {
      const response = await fetchDocumentSummaries({ limit: pageSize, offset: documents.length })
      documents = [...documents, ...response.documents]
      hasMore = response.hasMore
    } catch (error) {
      documentsError = error instanceof Error ? error.message : 'Failed to load documents'
    } finally {
      loadingDocuments = false
    }
  }

  async function performCreate() {
    if (creating) return null
    creating = true
    try {
      const document = await createDocument()
      await refreshList()
      await goto(`/${document.id}`)
      return document
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create document')
      return null
    } finally {
      creating = false
    }
  }

  async function performDelete(id: string) {
    try {
      await deleteDocument(id)
      clearDraft(id)
      toast.success('Document deleted')
      await refreshList()
      options.onDocumentDeleted?.(id)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete document')
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
    refreshList,
    loadMore,
    performCreate,
    performDelete,
  }
}
