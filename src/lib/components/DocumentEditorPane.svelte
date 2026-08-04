<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { Document } from '$lib/documents'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import EditableText from './EditableText.svelte'
  import Button from './Button.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import { DOCUMENT_TYPES, getDocumentType } from '$lib/document-types'

  const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map(type => ({ value: type.value, label: type.label }))

  interface Props {
    document: Document
    content: string
    docType: string
    saving: boolean
    refreshing?: boolean
    maxContentLength?: number
    onSave: () => void
    onReset: () => void
    onRename: (name: string) => void
    onTypeChange: (type: string) => void
    onClone: () => void
  }

  let {
    document,
    content = $bindable(),
    docType = $bindable(),
    saving,
    refreshing = false,
    maxContentLength = 0,
    onSave,
    onReset,
    onRename,
    onTypeChange,
    onClone,
  }: Props = $props()

  const dirty = $derived(content !== document.content || docType !== document.documentType)

  let fileInputRef = $state<HTMLInputElement | null>(null)
  let uploadConfirmOpen = $state(false)

  function openFilePicker() {
    fileInputRef?.click()
  }

  function handleUploadClick() {
    if (dirty) {
      uploadConfirmOpen = true
      return
    }
    openFilePicker()
  }

  function handleUploadConfirm() {
    uploadConfirmOpen = false
    openFilePicker()
  }

  async function handleFileChange() {
    const file = fileInputRef?.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const byteSize = new TextEncoder().encode(text).byteLength
      if (byteSize > 1024 * 1024) {
        toast.error('File exceeds the 1 MB limit')
        return
      }
      if (maxContentLength > 0 && text.length > maxContentLength) {
        toast.error(`File exceeds the ${maxContentLength}-character limit`)
        return
      }
      content = text
      toast.success('File uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to read file')
    } finally {
      if (fileInputRef) {
        fileInputRef.value = ''
      }
    }
  }

  function handleSave() {
    if (!dirty || saving) return
    onSave()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy')
    }
  }

  function handleExport() {
    const currentType = getDocumentType(docType)
    const blob = new Blob([content], { type: `${currentType.mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = `${document.name || 'document'}.${currentType.extension}`
    globalThis.document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function handleTypeSelect(value: string) {
    if (value !== docType) {
      docType = value
      onTypeChange(value)
    }
  }

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }

  const formattedTimestamp = $derived.by(() => {
    const date = new Date(document.updatedAt)
    if (Number.isNaN(date.getTime())) return document.updatedAt
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  })

  const currentType = $derived(getDocumentType(docType))
  const activeTypeLabel = $derived(currentType.label)
</script>

<section class="flex h-full min-w-0 flex-1 flex-col p-4">
  <div class="flex items-center justify-between gap-3">
    <EditableText
      text={document.name}
      className="font-semibold text-slate-200"
      onChange={onRename} />
    <div class="flex items-center gap-1">
      <SelectDropdown
        buttonLabel={activeTypeLabel}
        options={DOCUMENT_TYPE_OPTIONS}
        activeValue={docType}
        ariaLabel="Document type"
        filterable={true}
        size="sm"
        onSelect={handleTypeSelect}
        align="right"
        autoPlace={true} />
      {#if currentType.actions}
        {#await currentType.actions() then Actions}
          <Actions
            type={currentType}
            content={content}
            onContentChange={(value: string) => (content = value)}
            onTypeChange={handleTypeSelect} />
        {/await}
      {/if}
      <Button
        size="sm"
        ariaLabel="Copy"
        tooltip="Copy"
        onClick={handleCopy}
        disabled={content.length === 0}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
            <path d="M13 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Clone document"
        tooltip="Clone"
        onClick={onClone}
        disabled={content.length === 0}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="3" y="3" width="10" height="10" rx="1.5" />
            <path d="M13 7h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Upload"
        tooltip="Upload"
        onClick={handleUploadClick}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 16V7m0 0 3.5 3.5M10 7 6.5 10.5M4 4h12" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Export"
        tooltip="Export"
        onClick={handleExport}
        disabled={content.length === 0}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 16h12" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Reset" tooltip="Reset" onClick={onReset} disabled={!dirty || saving}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Save"
        tooltip="Save"
        onClick={handleSave}
        disabled={!dirty || saving}
        variant="primary"
        accent="cyan">
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M4 2h9l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm0 2v13h12V7.7L12.3 4H4Zm2 2v3h6V4H6v2Zm1 7h6v1H7v-1Z" />
          </svg>
        {/snippet}
      </Button>
    </div>
  </div>

  <LazyCodeEditor
    bind:content
    {docType}
    autoFocus={true}
    recreateKey={document.id}
    {maxContentLength}
    containerClass="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 transition focus-within:border-cyan-500"
    editorClass="h-full" />

  <input
    bind:this={fileInputRef}
    type="file"
    accept="text/plain,.txt,.md,.json,.csv,.html,.js,.xml,.yml,.yaml,application/json,text/markdown,text/html,text/xml,text/javascript"
    class="hidden"
    onchange={handleFileChange} />

  <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
    <span>
      Last updated at
      <span class="text-slate-300">{formattedTimestamp}</span>
      {#if document.updatedBy}
        <span>
          by <span class="text-slate-300">{document.updatedBy}</span>
        </span>
      {/if}
    </span>
    <span class="flex items-center gap-3">
      {#if refreshing}
        <span class="text-slate-500">Refreshing...</span>
      {/if}
      <span>{content.length} {#if maxContentLength > 0}/ {maxContentLength}{/if} chars</span>
    </span>
  </div>
</section>

{#if uploadConfirmOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="You have unsaved changes. Uploading a file will discard them and replace the editor content."
    confirmLabel="Discard & Upload"
    badgeColor="amber"
    badgeLabel="Confirm"
    confirmColor="amber"
    onConfirm={handleUploadConfirm}
    onCancel={() => (uploadConfirmOpen = false)} />
{/if}
