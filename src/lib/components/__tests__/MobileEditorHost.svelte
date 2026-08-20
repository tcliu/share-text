<script lang="ts">
  import { setShareTextContext } from '$lib/share-text-context'
  import type { Document } from '$lib/documents'
  import DocumentEditorPane from '../DocumentEditorPane.svelte'

  interface Props {
    docType?: string
    withClone?: boolean
    withTags?: boolean
    versionCount?: number
    onClone?: () => void
    onOpenDrawer?: () => void
    editable?: boolean
    initialContent?: string
  }

  let {
    docType = 'markdown',
    withClone = false,
    withTags = true,
    versionCount = 0,
    onClone,
    onOpenDrawer,
    editable = true,
    initialContent = 'hello',
  }: Props = $props()

  // initialContent is fixed test setup captured at component init.
  // svelte-ignore state_referenced_locally
  let content = $state(initialContent)

  setShareTextContext({
    documents: [],
    loadingDocuments: false,
    documentsError: null,
    createDocument: () => {},
    deleteDocument: () => {},
    refreshList: async () => {},
    updateDocumentSummary: () => {},
    selectedDocumentRefreshToken: 0,
    requestSelectedDocumentRefresh: () => {},
    registerEditorGuard: () => {},
    unregisterEditorGuard: () => {},
    canLeaveCurrentDocument: () => true,
    registerEditorFocus: () => {},
    unregisterEditorFocus: () => {},
    // svelte-ignore state_referenced_locally
    openMobileDrawer: onOpenDrawer ?? (() => {}),
    isMobile: true,
    user: null,
    admin: null,
    signOut: () => {},
  })

  const document = $derived.by<Document>(() => ({
    id: 'aaaaaa',
    name: 'My Document',
    documentType: docType,
    tags: withTags
      ? [
          { name: 'alpha', color: '#55FF55' },
          { name: 'beta', color: '#55A6FF' },
        ]
      : [],
    content: initialContent,
    updatedAt: '2026-08-01T00:00:00.000Z',
    updatedBy: '203.0.113.7',
  }))
</script>

<DocumentEditorPane
  document={document}
  bind:content
  {docType}
  saving={false}
  onSave={() => {}}
  onReset={() => {}}
  onRename={() => {}}
  onTypeChange={() => {}}
  {editable}
  {versionCount}
  onClone={withClone ? onClone ?? (() => {}) : undefined}
  onTagsSave={() => {}} />
