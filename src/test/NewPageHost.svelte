<script lang="ts">
  import { setShareTextContext } from '$lib/share-text-context'
  import NewPage from '../routes/(browser)/new/+page.svelte'

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
</script>

<NewPage
  data={{ maxContentLength: 100000, documents: [], hasMore: false, devTag: null }}
  params={{}}
  form={null} />
