<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { Document } from '$lib/documents'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import EditableText from './EditableText.svelte'
  import Button from './Button.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import TagsDialog from './TagsDialog.svelte'
  import KebabMenu from './KebabMenu.svelte'
  import FormatDialog from './FormatDialog.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import Splitter from './Splitter.svelte'
  import PreviewPane from './PreviewPane.svelte'
  import Chip from './Chip.svelte'
  import { DOCUMENT_TYPES, getDocumentType } from '$lib/document-types'
  import { tagChipClass, tagChipStyle, type Tag } from '$lib/tag-colors'
  import { usePreviewMode } from './use-preview-mode.svelte'
  import { EDITOR_PREVIEW_MIN_PCT, EDITOR_PREVIEW_MAX_PCT } from '$lib/editor-preview-split'
  import { usePreviewContent } from './use-preview-content.svelte'
  import { getShareTextContext } from '$lib/share-text-context'

  const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map(type => ({ value: type.value, label: type.label }))

  interface Props {
    document: Document
    content: string
    docType: string
    saving: boolean
    refreshing?: boolean
    maxContentLength?: number
    availableTags?: Tag[]
    savedName?: string
    onSave: () => void
    onReset: () => void
    onRename?: (name: string) => void
    onTypeChange: (type: string) => void
    onClone?: () => void
    cloneDisabled?: boolean
    focusOnReset?: boolean
    focusOnMount?: boolean
    onTagsSave?: (tags: Tag[]) => void
  }

  let {
    document,
    content = $bindable(),
    docType = $bindable(),
    saving,
    refreshing = false,
    maxContentLength = 0,
    availableTags = [],
    savedName,
    onSave,
    onReset,
    onRename,
    onTypeChange,
    onClone,
    cloneDisabled = false,
    focusOnReset = false,
    focusOnMount = false,
    onTagsSave,
  }: Props = $props()

  const dirty = $derived(
    content !== document.content ||
      docType !== document.documentType ||
      document.name !== (savedName ?? document.name),
  )

  let editorRef = $state<{ focus: () => void } | null>(null)

  $effect(() => {
    if (focusOnMount) {
      editorRef?.focus()
    }
  })

  $effect(() => {
    context.registerEditorFocus(() => editorRef?.focus())
    return () => context.unregisterEditorFocus()
  })

  function handleResetClick() {
    onReset()
    if (focusOnReset) {
      editorRef?.focus()
    }
  }

  let fileInputRef = $state<HTMLInputElement | null>(null)
  let uploadConfirmOpen = $state(false)
  let tagsOpen = $state(false)
  let formatDialogOpen = $state(false)

  async function handleFormatConfirm(indent: number) {
    const format = currentType.format
    if (!format) return
    const result = await format.format(content, indent)
    if (result.ok) {
      content = result.value ?? ''
    } else {
      toast.error('Cannot format: ' + (result.error ?? `Invalid ${currentType.label}`))
    }
    formatDialogOpen = false
  }

  const currentType = $derived(getDocumentType(docType))
  const hasPreview = () => Boolean(currentType.preview)
  const context = getShareTextContext()
  const previewState = usePreviewMode(hasPreview, () => context.isMobile)

  const previewContent = usePreviewContent(() => content, () => document.id)

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

  async function handleTypeSelect(value: string) {
    if (value === docType) return
    const fromType = getDocumentType(docType)
    const toType = getDocumentType(value)
    if (fromType.convertTo?.target === value) {
      const result = await fromType.convertTo.convert(content)
      if (!result.ok) {
        toast.error('Cannot convert: ' + (result.error ?? 'Invalid content'))
        return
      }
      content = result.value ?? ''
    }
    docType = value
    onTypeChange(value)
  }

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }

  const formattedTimestamp = $derived.by(() => {
    const date = new Date(document.updatedAt)
    if (Number.isNaN(date.getTime())) return document.updatedAt
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  })

  const activeTypeLabel = $derived(currentType.label)
  const documentTags = $derived(document.tags ?? [])
</script>

<section class="flex h-full min-w-0 flex-1 flex-col p-4">
  {#snippet nameField()}
    {#if onRename}
      <EditableText
        text={document.name}
        className="font-semibold text-slate-200"
        onChange={onRename} />
    {:else}
      <span class="truncate font-semibold text-slate-200">{document.name}</span>
    {/if}
  {/snippet}

  {#snippet typeSelector()}
    <div class="flex flex-none items-center">
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
    </div>
  {/snippet}

  {#snippet tagChips()}
    {#if documentTags.length > 0}
      <div class="flex flex-none flex-wrap items-center gap-1.5">
        {#each documentTags as tag (tag.name)}
          <Chip label={tag.name} chipClass={tagChipClass()} style={tagChipStyle(tag.color)} />
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet actionButtons()}
    {#if currentType.preview && !context.isMobile}
      <Button
        size="sm"
        ariaLabel="Editor view"
        tooltip="Editor view"
        variant={previewState.editorActive ? 'outline' : 'secondary'}
        ariaPressed={previewState.editorActive}
        disabled={previewState.editorDisabled}
        onClick={() => previewState.setEditor(!previewState.editorActive)}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Preview view"
        tooltip="Preview view"
        variant={previewState.previewActive ? 'outline' : 'secondary'}
        ariaPressed={previewState.previewActive}
        disabled={previewState.previewDisabled}
        onClick={() => previewState.setPreview(!previewState.previewActive)}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path
              fill-rule="evenodd"
              d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
              clip-rule="evenodd" />
          </svg>
        {/snippet}
      </Button>
    {/if}
    {#if currentType.actions && !context.isMobile}
      {#await currentType.actions() then Actions}
        <Actions
          type={currentType}
          content={content}
          onContentChange={(value: string) => (content = value)} />
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
    {#if (onClone || cloneDisabled) && !context.isMobile}
      <Button
        size="sm"
        ariaLabel="Clone document"
        tooltip="Clone"
        onClick={onClone}
        disabled={cloneDisabled || content.length === 0}>
        {#snippet icon()}
          {@render cloneIcon()}
        {/snippet}
      </Button>
    {/if}
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
    <Button size="sm" ariaLabel="Reset" tooltip="Reset" onClick={handleResetClick} disabled={!dirty || saving}>
      {#snippet icon()}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 10a6 6 0 0 1 10.7-3.7M16 10a6 6 0 0 1-10.7 3.7" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 2v4h-4M5 18v-4h4" />
        </svg>
      {/snippet}
    </Button>
    {#if onTagsSave}
      <Button size="sm" ariaLabel="Edit tags" tooltip="Tags" onClick={() => (tagsOpen = true)}>
        {#snippet icon()}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.6 3H6a2 2 0 0 0-2 2v4.6a2 2 0 0 0 .59 1.41l4.4 4.4a2 2 0 0 0 2.83 0l3.58-3.58a2 2 0 0 0 0-2.83L11.99 3.6A2 2 0 0 0 10.6 3Z" />
            <circle cx="7.25" cy="7.25" r="1.25" />
          </svg>
        {/snippet}
      </Button>
    {/if}
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
  {/snippet}

  {#snippet cloneIcon()}
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M13 7h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2" />
    </svg>
  {/snippet}

  {#snippet formatIcon()}
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"
        clip-rule="evenodd" />
    </svg>
  {/snippet}

  {#if context.isMobile}
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex min-w-[min(12rem,60%)] flex-1 items-center gap-2">
          {@render nameField()}
        </div>
        {@render typeSelector()}
      </div>
      {#if documentTags.length > 0}
        <div class="flex flex-wrap items-center gap-1.5" data-testid="editor-tags">
          {@render tagChips()}
        </div>
      {/if}
      <div class="flex flex-wrap items-center gap-1" data-testid="editor-actions">
        {#if currentType.preview}
          <Button
            size="sm"
            ariaLabel="Preview"
            tooltip="Preview"
            variant={previewState.previewActive ? 'outline' : 'secondary'}
            ariaPressed={previewState.previewActive}
            onClick={previewState.togglePreview}>
            {#snippet icon()}
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path
                  fill-rule="evenodd"
                  d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                  clip-rule="evenodd" />
              </svg>
            {/snippet}
          </Button>
        {/if}
        {@render actionButtons()}
        {#if currentType.format || onClone || cloneDisabled}
          <KebabMenu
            ariaLabel="More actions"
            items={[
              ...(onClone || cloneDisabled
                ? [
                    {
                      id: 'clone',
                      label: 'Clone',
                      onClick: () => onClone?.(),
                      disabled: cloneDisabled || content.length === 0,
                      icon: cloneIcon,
                    },
                  ]
                : []),
              ...(currentType.format
                ? [
                    {
                      id: 'format',
                      label: currentType.format.title,
                      onClick: () => (formatDialogOpen = true),
                      icon: formatIcon,
                    },
                  ]
                : []),
            ]} />
        {/if}
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
      <div class="flex min-w-0 grow basis-[min-content] flex-wrap items-center gap-2">
        {@render nameField()}
        {@render tagChips()}
      </div>
      {@render typeSelector()}
      <div class="flex shrink min-w-0 flex-wrap items-center gap-1">
        {@render actionButtons()}
      </div>
    </div>
  {/if}

  <div
    class="mt-3 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 transition focus-within:border-cyan-500">
    {#if !previewState.previewOnly}
      <div
        style={previewState.previewMode === 'split' && previewState.showPreview ? `flex-basis: ${previewState.editorWidthPct}%` : 'flex: 1'}
        class="min-w-0 overflow-hidden">
        <LazyCodeEditor
          bind:this={editorRef}
          bind:content
          {docType}
          autoFocus={focusOnMount}
          recreateKey={document.id}
          {maxContentLength}
          containerClass="h-full"
          editorClass="h-full" />
      </div>
    {/if}
    {#if previewState.previewMode === 'split' && previewState.showPreview}
      <Splitter
        value={previewState.editorWidthPct}
        min={EDITOR_PREVIEW_MIN_PCT}
        max={EDITOR_PREVIEW_MAX_PCT}
        unit="%"
        onChange={(value: number) => (previewState.editorWidthPct = value)}
        ariaLabel="Resize editor and preview panes" />
    {/if}
    {#if previewState.showPreview && currentType.preview}
      <div class="min-w-0 flex-1 overflow-hidden">
        <PreviewPane
          preview={currentType.preview}
          content={previewContent.value}
          {docType}
          onContentChange={(v: string) => (content = v)} />
      </div>
    {/if}
  </div>

  <input
    bind:this={fileInputRef}
    type="file"
    accept="text/plain,.txt,.md,.json,.csv,.html,.js,.xml,.yml,.yaml,application/json,text/markdown,text/html,text/xml,text/javascript"
    class="hidden"
    onchange={handleFileChange} />

  <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
    {#if document.updatedAt}
      <span>
        Last updated at
        <span class="text-slate-300">{formattedTimestamp}</span>
        {#if document.updatedBy}
          <span>
            by <span class="text-slate-300">{document.updatedBy}</span>
          </span>
        {/if}
      </span>
    {/if}
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
    confirmLabel="OK"
    confirmColor="amber"
    onConfirm={handleUploadConfirm}
    onCancel={() => (uploadConfirmOpen = false)} />
{/if}

{#if onTagsSave}
  <TagsDialog
    open={tagsOpen}
    tags={document.tags ?? []}
    {availableTags}
    onClose={() => (tagsOpen = false)}
    onSave={onTagsSave} />
{/if}

{#if currentType.format}
  <FormatDialog
    show={formatDialogOpen}
    title={currentType.format.title}
    hasIndent={currentType.format.hasIndent ?? true}
    onConfirm={indent => void handleFormatConfirm(indent)}
    onCancel={() => (formatDialogOpen = false)} />
{/if}
