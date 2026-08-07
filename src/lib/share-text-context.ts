import { getContext, setContext } from 'svelte'
import type { DocumentSummary } from './documents'

export interface EditorGuard {
  isDirty: () => boolean
  confirmDiscard: () => void
  getCurrentDocumentId: () => string | null
}

export interface ShareTextContext {
  documents: DocumentSummary[]
  loadingDocuments: boolean
  documentsError: string | null
  createDocument: () => void
  deleteDocument: (id: string) => void
  refreshList: () => Promise<void>
  selectedDocumentRefreshToken: number
  requestSelectedDocumentRefresh: () => void
  registerEditorGuard: (guard: EditorGuard) => void
  unregisterEditorGuard: () => void
  canLeaveCurrentDocument: () => boolean
  registerEditorFocus: (focus: () => void) => void
  unregisterEditorFocus: () => void
}

const KEY = Symbol('share-text-context')

export function setShareTextContext(context: ShareTextContext) {
  setContext(KEY, context)
}

export function getShareTextContext(): ShareTextContext {
  return getContext(KEY)
}
