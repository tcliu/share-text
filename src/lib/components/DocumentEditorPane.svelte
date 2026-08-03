<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { Document } from '$lib/documents'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import EditableName from './EditableName.svelte'
  import Button from './Button.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'

  interface Props {
    document: Document
    content: string
    saving: boolean
    refreshing?: boolean
    maxContentLength?: number
    onSave: () => void
    onReset: () => void
    onRename: (name: string) => void
  }

  let {
    document,
    content = $bindable(),
    saving,
    refreshing = false,
    maxContentLength = 0,
    onSave,
    onReset,
    onRename,
  }: Props = $props()

  const dirty = $derived(content !== document.content)

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
      toast.error('Failed to read file')
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
      toast.error('Failed to copy')
    }
  }

  function handleDownload() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = `${document.name || 'document'}.txt`
    globalThis.document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }
</script>

<section class="flex h-full min-w-0 flex-1 flex-col p-4">
  <div class="flex items-center justify-between gap-3">
    <EditableName
      name={document.name}
      fontSizeClass="text-[15px]"
      className="font-semibold text-slate-200"
      onRename={onRename} />
    <div class="flex items-center gap-1">
      <Button
        size="sm"
        ariaLabel="Copy"
        tooltip="Copy"
        onClick={handleCopy}
        disabled={content.length === 0}>
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
            <path d="M13 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Upload"
        tooltip="Upload"
        onClick={handleUploadClick}>
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 16V7m0 0 3.5 3.5M10 7 6.5 10.5M4 4h12" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Download"
        tooltip="Download"
        onClick={handleDownload}
        disabled={content.length === 0}>
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 16h12" />
          </svg>
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Reset" tooltip="Reset" onClick={onReset} disabled={!dirty || saving}>
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
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
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M4 2h9l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm0 2v13h12V7.7L12.3 4H4Zm2 2v3h6V4H6v2Zm1 7h6v1H7v-1Z" />
          </svg>
        {/snippet}
      </Button>
    </div>
  </div>

  <LazyCodeEditor
    bind:content
    autoFocus={true}
    recreateKey={document.id}
    {maxContentLength}
    containerClass="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 transition focus-within:border-cyan-500"
    editorClass="h-full" />

  <input
    bind:this={fileInputRef}
    type="file"
    accept="text/plain,.txt,.md,.json,.csv,.html,.css,.js,.ts,.svelte,application/json,text/markdown"
    class="hidden"
    onchange={handleFileChange} />

  <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
    <span>{dirty ? 'Unsaved changes' : 'No changes'}</span>
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
