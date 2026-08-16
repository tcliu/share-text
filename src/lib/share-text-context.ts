import { getContext, setContext } from 'svelte'
import type { AdminIdentity } from './user-auth'
import type { DocumentSummary, OwnedDocumentSummary, User } from './documents'

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
  updateDocumentSummary: (id: string, changes: Partial<OwnedDocumentSummary>) => void
  selectedDocumentRefreshToken: number
  requestSelectedDocumentRefresh: () => void
  registerEditorGuard: (guard: EditorGuard) => void
  unregisterEditorGuard: () => void
  canLeaveCurrentDocument: () => boolean
  registerEditorFocus: (focus: () => void) => void
  unregisterEditorFocus: () => void
  openMobileDrawer: () => void
  isMobile: boolean
  user: User | null
  admin: AdminIdentity | null
  signOut: () => void
}

const KEY = Symbol('share-text-context')

export function setShareTextContext(context: ShareTextContext) {
  setContext(KEY, context)
}

export function getShareTextContext(): ShareTextContext {
  return getContext(KEY)
}
