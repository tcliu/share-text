<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { PageProps } from './$types'
  import { createDocument, type Document } from '$lib/documents'
  import { goto } from '$app/navigation'
  import { getDocumentType } from '$lib/document-types'
  import { getShareTextContext } from '$lib/share-text-context'
  import { clearDraft, loadDraft, loadDraftDocType, loadDraftName, saveDraft, NEW_DOCUMENT_DRAFT_ID } from '$lib/document-drafts'
  import DocumentEditorPane from '$lib/components/DocumentEditorPane.svelte'
  import { t } from '$lib/i18n.svelte'

  let { data }: PageProps = $props()

  const context = getShareTextContext()

  const DRAFT_ID = NEW_DOCUMENT_DRAFT_ID

  let documentName = $state(t('doc.untitled'))
  let savedName = $state(t('doc.untitled'))
  let savedContent = $state('')
  let savedDocType = $state('text')
  let content = $state('')
  let docType = $state('text')
  let saving = $state(false)
  let draftLoaded = $state(false)
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const dirty = $derived(content !== savedContent || docType !== savedDocType || documentName !== savedName)

  const draftDocument = $derived.by<Document>(() => ({
    id: DRAFT_ID,
    name: documentName,
    documentType: savedDocType,
    tags: [],
    content: savedContent,
    updatedAt: '',
    updatedBy: '',
  }))

  function flushDraft() {
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
    if (dirty) {
      saveDraft(DRAFT_ID, content, docType, documentName)
    }
  }

  $effect(() => {
    if (!draftLoaded) {
      draftLoaded = true
      const draft = loadDraft(DRAFT_ID)
      if (draft !== null && draft !== content) {
        content = draft
      }
      const draftType = loadDraftDocType(DRAFT_ID)
      if (draftType !== null) {
        docType = draftType
      }
      const draftName = loadDraftName(DRAFT_ID)
      if (draftName !== null) {
        documentName = draftName
      }
    }
    if (!dirty) {
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
      }
      clearDraft(DRAFT_ID)
      return
    }
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      if (dirty) {
        saveDraft(DRAFT_ID, content, docType, documentName)
      }
    }, 400)
  })

  $effect(() => {
    context.registerEditorGuard({
      isDirty: () => dirty,
      confirmDiscard: () => {
        documentName = savedName
        content = savedContent
        docType = savedDocType
      },
      getCurrentDocumentId: () => DRAFT_ID,
    })
    return () => context.unregisterEditorGuard()
  })

  function handleRename(name: string) {
    documentName = name
  }

  async function handleSave() {
    if (!dirty || saving) return
    const currentType = getDocumentType(docType)
    const validation = await currentType.validate(content)
    if (!validation.valid) {
      toast.error(t('doc.toast.cannotSave', { error: validation.error ?? t('doc.toast.invalidType', { label: currentType.label }) }))
      return
    }
    saving = true
    try {
      const created = await createDocument({ name: documentName, content, documentType: docType })
      clearDraft(DRAFT_ID)
      savedName = created.name
      savedContent = created.content
      savedDocType = created.documentType
      documentName = created.name
      content = created.content
      docType = created.documentType
      toast.success(t('doc.toast.saved'))
      await context.refreshList()
      await goto(`/${created.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('doc.toast.saveFailed'))
    } finally {
      saving = false
    }
  }

  function handleReset() {
    if (!dirty || saving) return
    clearDraft(DRAFT_ID)
    documentName = savedName
    content = savedContent
    docType = savedDocType
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || (event.key !== 's' && event.key !== 'S')) return
    event.preventDefault()
    if (dirty && !saving) {
      handleSave()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onpagehide={flushDraft} />

<DocumentEditorPane
  document={draftDocument}
  bind:content
  bind:docType
  {saving}
  refreshing={context.loadingDocuments}
  maxContentLength={data.maxContentLength}
  availableTags={[]}
  savedName={savedName}
  onSave={handleSave}
  onReset={handleReset}
  onRename={handleRename}
  onTypeChange={(type: string) => (docType = type)}
  cloneDisabled
  focusOnReset
  focusOnMount /> 
