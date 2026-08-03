<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { PageProps } from './$types'
  import { fetchDocument, updateDocument, type Document } from '$lib/documents'
  import { getShareTextContext } from '$lib/share-text-context'
  import { clearDraft, loadDraft, saveDraft } from '$lib/document-drafts'
  import DocumentEditorPane from '$lib/components/DocumentEditorPane.svelte'

  let { data }: PageProps = $props()

  const context = getShareTextContext()

  let currentId = $state('')
  let documentName = $state('')
  let savedContent = $state('')
  let content = $state('')
  let saving = $state(false)
  let refreshing = $state(false)
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const dirty = $derived(content !== savedContent)

  const savedDocument = $derived.by<Document>(() => ({
    id: currentId,
    name: documentName,
    content: savedContent,
    updatedAt: data.document.updatedAt,
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
      savedContent = document.content
      content = document.content
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
    savedContent = document.content
    content = loadDraft(document.id) ?? document.content
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
    saving = true
    try {
      const updated = await updateDocument(currentId, { content })
      clearDraft(currentId)
      savedContent = updated.content
      content = updated.content
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
  }

  async function handleRename(name: string) {
    if (!currentId || !name) return
    try {
      const updated = await updateDocument(currentId, { name })
      documentName = updated.name
      toast.success('Document renamed')
      await context.refreshList()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename document')
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
    {saving}
    refreshing={refreshing || context.loadingDocuments}
    maxContentLength={data.maxContentLength}
    onSave={handleSave}
    onReset={handleReset}
    onRename={handleRename} />
{/if}
