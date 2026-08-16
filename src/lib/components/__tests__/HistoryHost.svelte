<script lang="ts">
  import { setShareTextContext } from '$lib/share-text-context'
  import type { Document } from '$lib/documents'
  import DocumentEditorPane from '../DocumentEditorPane.svelte'

  interface Props {
    versionCount?: number
  }

  let { versionCount = 2 }: Props = $props()

  let content = $state('hello')
  let docType = $state('markdown')

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
    openMobileDrawer: () => {},
    isMobile: false,
    user: null,
    admin: null,
    signOut: () => {},
  })

  const document: Document = {
    id: 'aaaaaa',
    name: 'My Document',
    documentType: 'markdown',
    tags: [],
    content: 'hello',
    updatedAt: '2026-08-01T00:00:00.000Z',
    updatedBy: '203.0.113.7',
  }
</script>

<DocumentEditorPane
  {document}
  bind:content
  bind:docType
  saving={false}
  {versionCount}
  onSave={() => {}}
  onReset={() => {}}
  onRename={() => {}}
  onTypeChange={() => {}}
  onTagsSave={() => {}} />
