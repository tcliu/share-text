import { goto } from '$app/navigation'
import { beforeNavigate } from '$app/navigation'
import type { EditorGuard } from '$lib/share-text-context'

type PendingAction =
  | { kind: 'new' }
  | { kind: 'refresh' }
  | { kind: 'navigate'; url: string }
  | { kind: 'delete'; id: string }

export function useEditorGuard() {
  let editorGuard = $state<EditorGuard | null>(null)
  let discardDialogOpen = $state(false)
  let pendingAction = $state<PendingAction | null>(null)

  function registerEditorGuard(guard: EditorGuard) {
    editorGuard = guard
  }

  function unregisterEditorGuard() {
    editorGuard = null
  }

  function canLeaveCurrentDocument() {
    return !editorGuard || !editorGuard.isDirty()
  }

  function runPendingAction(action: PendingAction) {
    if (action.kind === 'new') {
      // This will be handled by the caller
    } else if (action.kind === 'refresh') {
      // This will be handled by the caller
    } else if (action.kind === 'delete') {
      // This will be handled by the caller
    } else if (action.kind === 'navigate') {
      goto(action.url)
    }
  }

  function handleConfirmDiscard() {
    editorGuard?.confirmDiscard()
    const action = pendingAction
    pendingAction = null
    discardDialogOpen = false
    if (action) {
      runPendingAction(action)
    }
    return action
  }

  function handleCancelDiscard() {
    discardDialogOpen = false
    pendingAction = null
  }

  function requestDiscard(action: PendingAction) {
    pendingAction = action
    discardDialogOpen = true
  }

  beforeNavigate(navigation => {
    if (canLeaveCurrentDocument()) return
    const url = navigation.to?.url
    if (!url) return
    navigation.cancel()
    requestDiscard({ kind: 'navigate', url: url.pathname + url.search })
  })

  return {
    get editorGuard() {
      return editorGuard
    },
    get discardDialogOpen() {
      return discardDialogOpen
    },
    get pendingAction() {
      return pendingAction
    },
    registerEditorGuard,
    unregisterEditorGuard,
    canLeaveCurrentDocument,
    handleConfirmDiscard,
    handleCancelDiscard,
    requestDiscard,
  }
}
