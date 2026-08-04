<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { PageProps } from './$types'
  import { fetchDocument, updateDocument, createDocument, type Document } from '$lib/documents'
  import { goto } from '$app/navigation'
  import { getDocumentType } from '$lib/document-types'
  import { getShareTextContext } from '$lib/share-text-context'
  import { clearDraft, loadDraft, saveDraft } from '$lib/document-drafts'
  import DocumentEditorPane from '$lib/components/DocumentEditorPane.svelte'

  let { data }: PageProps = $props()

  const context = getShareTextContext()

  let currentId = $state('')
  let documentName = $state('')
  let savedContent = $state('')
  let documentType = $state('text')
  let savedDocumentType = $state('text')
  let documentUpdatedAt = $state('')
  let documentUpdatedBy = $state('')
  let content = $state('')
  let docType = $state('text')
  let saving = $state(false)
  let refreshing = $state(false)
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const dirty = $derived(content !== savedContent || docType !== savedDocumentType)

  const savedDocument = $derived.by<Document>(() => ({
    id: currentId,
    name: documentName,
    documentType: savedDocumentType,
    content: savedContent,
    updatedAt: documentUpdatedAt,
    updatedBy: documentUpdatedBy,
  }))

  function flushDraft() {
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
    if (currentId && dirty) {
      saveDraft(currentId, content)
    }
  }

  $effect(() => {
    if (!currentId) return
    if (!dirty) {
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
      }
      clearDraft(currentId)
      return
    }
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      if (currentId && dirty) {
        saveDraft(currentId, content)
      }
    }, 400)
  })

  async function loadDocument(id: string) {
    refreshing = true
    try {
      const document = await fetchDocument(id)
      if (!document || document.id !== currentId) return
      documentName = document.name
      savedDocumentType = document.documentType
      documentType = document.documentType
      documentUpdatedAt = document.updatedAt
      documentUpdatedBy = document.updatedBy
      savedContent = document.content
      content = document.content
      docType = document.documentType
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load document')
    } finally {
      refreshing = false
    }
  }

  $effect(() => {
    const document = data.document
    if (document.id === currentId) return
    currentId = document.id
    documentName = document.name
    savedDocumentType = document.documentType
    documentType = document.documentType
    documentUpdatedAt = document.updatedAt
    documentUpdatedBy = document.updatedBy
    savedContent = document.content
    content = loadDraft(document.id) ?? document.content
    docType = document.documentType
  })

  $effect(() => {
    const token = context.selectedDocumentRefreshToken
    if (token === 0) return
    loadDocument(currentId)
  })

  $effect(() => {
    context.registerEditorGuard({
      isDirty: () => dirty,
      confirmDiscard: () => {
        content = savedContent
      },
      getCurrentDocumentId: () => currentId,
    })
    return () => context.unregisterEditorGuard()
  })

  async function handleSave() {
    if (!dirty || saving) return
    const currentType = getDocumentType(docType)
    const validation = await currentType.validate(content)
    if (!validation.valid) {
      toast.error('Cannot save: ' + (validation.error ?? `Invalid ${currentType.label}`))
      return
    }
    saving = true
    try {
      const options: { content?: string; documentType?: string } = {}
      if (content !== savedContent) options.content = content
      if (docType !== savedDocumentType) options.documentType = docType
      const updated = await updateDocument(currentId, options)
      clearDraft(currentId)
      savedContent = updated.content
      savedDocumentType = updated.documentType
      documentType = updated.documentType
      documentUpdatedAt = updated.updatedAt
      documentUpdatedBy = updated.updatedBy
      content = updated.content
      docType = updated.documentType
      toast.success('Document saved')
      await context.refreshList()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save document')
    } finally {
      saving = false
    }
  }

  function handleReset() {
    if (!dirty || saving) return
    clearDraft(currentId)
    content = savedContent
    docType = savedDocumentType
  }

  async function handleRename(name: string) {
    if (!currentId || !name) return
    try {
      const updated = await updateDocument(currentId, { name })
      documentName = updated.name
      documentUpdatedAt = updated.updatedAt
      documentUpdatedBy = updated.updatedBy
      toast.success('Document renamed')
      await context.refreshList()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename document')
    }
  }

  function handleTypeChange(type: string) {
    docType = type
  }

  async function handleClone() {
    if (!currentId) return
    const cloneName = documentName ? `${documentName} (copy)` : undefined
    try {
      const created = await createDocument({ name: cloneName, content, documentType: docType })
      clearDraft(created.id)
      toast.success('Document cloned')
      await context.refreshList()
      await goto(`/${created.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clone document')
    }
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

{#if currentId}
  <DocumentEditorPane
    document={savedDocument}
    bind:content
    bind:docType
    {saving}
    refreshing={refreshing || context.loadingDocuments}
    maxContentLength={data.maxContentLength}
    onSave={handleSave}
    onReset={handleReset}
    onRename={handleRename}
    onTypeChange={handleTypeChange}
    onClone={handleClone} />
{/if}
