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
  }

  let { docType = 'markdown', withClone = false, withTags = true, versionCount = 0, onClone }: Props = $props()

  let content = $state('hello')

  setShareTextContext({
    documents: [],
    loadingDocuments: false,
    documentsError: null,
    createDocument: () => {},
    deleteDocument: () => {},
    refreshList: async () => {},
    selectedDocumentRefreshToken: 0,
    requestSelectedDocumentRefresh: () => {},
    registerEditorGuard: () => {},
    unregisterEditorGuard: () => {},
    canLeaveCurrentDocument: () => true,
    registerEditorFocus: () => {},
    unregisterEditorFocus: () => {},
    isMobile: true,
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
    content: 'hello',
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
  {versionCount}
  onClone={withClone ? onClone ?? (() => {}) : undefined}
  onTagsSave={() => {}} />
