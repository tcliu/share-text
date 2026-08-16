<script lang="ts">
  import { onDestroy } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { Document } from '$lib/documents'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import EditableText from './EditableText.svelte'
  import Button from './Button.svelte'
  import RefreshIcon from '$lib/icons/RefreshIcon.svelte'
  import PencilIcon from '$lib/icons/PencilIcon.svelte'
  import EyeIcon from '$lib/icons/EyeIcon.svelte'
  import CopyIcon from '$lib/icons/CopyIcon.svelte'
  import SpeakerIcon from '$lib/icons/SpeakerIcon.svelte'
  import StopIcon from '$lib/icons/StopIcon.svelte'
  import LinkIcon from '$lib/icons/LinkIcon.svelte'
  import TagsIcon from '$lib/icons/TagsIcon.svelte'
  import SaveIcon from '$lib/icons/SaveIcon.svelte'
  import CloneIcon from '$lib/icons/CloneIcon.svelte'
  import HistoryIcon from '$lib/icons/HistoryIcon.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'
  import ExportIcon from '$lib/icons/ExportIcon.svelte'
  import FormatIcon from '$lib/icons/FormatIcon.svelte'
  import MenuIcon from '$lib/icons/MenuIcon.svelte'
  import ShareIcon from '$lib/icons/ShareIcon.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import TagsDialog from './TagsDialog.svelte'
  import KebabMenu from './KebabMenu.svelte'
  import FormatDialog from './FormatDialog.svelte'
  import HistoryDialog from './HistoryDialog.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import Splitter from './Splitter.svelte'
  import PreviewPane from './PreviewPane.svelte'
  import Chip from './Chip.svelte'
  import Copyable from './Copyable.svelte'
  import { DOCUMENT_TYPES, getDocumentType } from '$lib/document-types'
  import { tagChipClass, tagChipStyle, type Tag } from '$lib/tag-colors'
  import { usePreviewMode } from './use-preview-mode.svelte'
  import { EDITOR_PREVIEW_MIN_PCT, EDITOR_PREVIEW_MAX_PCT } from '$lib/editor-preview-split'
  import { usePreviewContent } from './use-preview-content.svelte'
  import { useFormat } from './use-format.svelte'
  import { getShareTextContext } from '$lib/share-text-context'
  import { formatTimestamp } from '$lib/date-format'
  import { loadTtsCapabilities, synthesizeTtsCached } from '$lib/tts-client'
  import { splitTtsSegments } from '$lib/tts-language'

  const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map(type => ({ value: type.value, label: type.label }))

  interface Props {
    document: Document
    content: string
    docType: string
    saving: boolean
    refreshing?: boolean
    maxContentLength?: number
    availableTags?: Tag[]
    versionCount?: number
    savedName?: string
    editable?: boolean
    onSave: () => void
    onReset: () => void
    onRename?: (name: string) => void
    onTypeChange: (type: string) => void
    onClone?: () => void
    cloneDisabled?: boolean
    focusOnReset?: boolean
    focusOnMount?: boolean
    onTagsSave?: (tags: Tag[]) => void
    onShare?: () => void
    onDelete?: (id: string) => void
  }

  let {
    document,
    content = $bindable(),
    docType = $bindable(),
    saving,
    refreshing = false,
    maxContentLength = 0,
    availableTags = [],
    versionCount = 0,
    savedName,
    editable = true,
    onSave,
    onReset,
    onRename,
    onTypeChange,
    onClone,
    cloneDisabled = false,
    focusOnReset = false,
    focusOnMount = false,
    onTagsSave,
    onShare,
    onDelete,
  }: Props = $props()

  const dirty = $derived(
    content !== document.content ||
      docType !== document.documentType ||
      document.name !== (savedName ?? document.name),
  )

  let editorRef = $state<{ focus: () => void; getSelectionText: () => string } | null>(null)
  let refocusEditor = $state(false)
  let ttsConfigured = $state(false)
  let speaking = $state(false)
  let audioRef = $state<HTMLAudioElement | null>(null)
  let ttsQueue = $state<string[]>([])
  let ttsQueueIndex = $state(0)
  let ttsObjectUrls: string[] = []
  let ttsAbortController: AbortController | null = null

  $effect(() => {
    let cancelled = false
    loadTtsCapabilities().then(capabilities => {
      if (!cancelled) {
        ttsConfigured = capabilities.configured
      }
    })
    return () => {
      cancelled = true
    }
  })

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
    if (!editable) return
    onReset()
    if (focusOnReset) {
      editorRef?.focus()
    }
  }

  let fileInputRef = $state<HTMLInputElement | null>(null)
  let uploadConfirmOpen = $state(false)
  let tagsOpen = $state(false)
  let historyOpen = $state(false)

  const currentType = $derived(getDocumentType(docType))
  const hasPreview = () => Boolean(currentType.preview)
  const context = getShareTextContext()
  const previewState = usePreviewMode(hasPreview)

  const formatState = useFormat({
    format: () => currentType.format,
    content: () => content,
    setContent: value => (content = value),
    label: () => currentType.label,
  })

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
    if (!editable || !dirty || saving) return
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

  async function handleCopyLink() {
    try {
      const url = new URL(window.location.href)
      url.pathname = `/${document.id}`
      url.search = ''
      url.hash = ''
      await navigator.clipboard.writeText(url.toString())
      toast.success('Link copied to clipboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy link')
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

  function releaseTtsObjectUrls() {
    for (const url of ttsObjectUrls) {
      URL.revokeObjectURL(url)
    }
    ttsObjectUrls = []
  }

  function stopReading() {
    ttsAbortController?.abort()
    ttsAbortController = null
    audioRef?.pause()
    ttsQueue = []
    ttsQueueIndex = 0
    releaseTtsObjectUrls()
    speaking = false
  }

  function playNextSegment() {
    const nextIndex = ttsQueueIndex + 1
    const nextUrl = ttsQueue[nextIndex]
    if (!nextUrl || !audioRef) {
      ttsQueue = []
      ttsQueueIndex = 0
      releaseTtsObjectUrls()
      speaking = false
      return
    }
    ttsQueueIndex = nextIndex
    audioRef.src = nextUrl
    audioRef.play().catch(() => {
      toast.error('Failed to play audio')
      stopReading()
    })
  }

  async function handleReadAloud() {
    if (speaking) {
      stopReading()
      return
    }
    if (!ttsConfigured) {
      toast.error('Text-to-speech is not configured')
      return
    }
    const selection = editorRef?.getSelectionText() ?? ''
    const text = selection.trim() ? selection : content
    const segments = splitTtsSegments(text)
    if (segments.length === 0) {
      toast.error('Nothing to read')
      return
    }
    speaking = true
    ttsAbortController = new AbortController()
    try {
      const blobs = await synthesizeTtsCached(
        segments,
        ttsAbortController?.signal,
      )
      if (ttsAbortController?.signal.aborted) {
        return
      }
      if (!audioRef) return
      releaseTtsObjectUrls()
      ttsObjectUrls = blobs.map(blob => URL.createObjectURL(blob))
      ttsQueue = ttsObjectUrls
      ttsQueueIndex = 0
      audioRef.src = ttsQueue[0]
      audioRef.play().catch(() => {
        toast.error('Failed to play audio')
        stopReading()
      })
    } catch (error) {
      if (ttsAbortController?.signal.aborted) {
        return
      }
      toast.error(error instanceof Error ? error.message : 'Failed to synthesize speech')
      stopReading()
    }
  }

  onDestroy(() => {
    ttsAbortController?.abort()
    ttsAbortController = null
    if (audioRef?.currentSrc) {
      audioRef.pause()
    }
    releaseTtsObjectUrls()
  })

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

  const formattedTimestamp = $derived(formatTimestamp(document.updatedAt))

  const activeTypeLabel = $derived(currentType.label)
  const documentTags = $derived(document.tags ?? [])
</script>

<section aria-label={document.name} class="flex h-full min-w-0 flex-1 flex-col p-4">
  {#snippet nameField()}
    {#if onRename && editable}
      <EditableText
        text={document.name}
        className="font-semibold text-slate-200"
        onChange={onRename} />
    {:else}
      <Copyable
        text={document.name}
        copyText={document.name}
        copyAriaLabel={`Copy document name ${document.name}`}
        copyTooltip="Copy"
        className="truncate font-semibold text-slate-200" />
    {/if}
  {/snippet}

  {#snippet typeSelector()}
    <div class="flex flex-none items-center">
      {#if editable}
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
      {:else}
        <Chip
          label={activeTypeLabel}
          chipClass={tagChipClass()}
          style={tagChipStyle(currentType.chipColor)} />
      {/if}
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

  {#snippet previewToggles()}
    <Button
      size="sm"
      ariaLabel="Editor view"
      tooltip="Editor view"
      variant={previewState.editorActive ? 'outline' : 'secondary'}
      ariaPressed={previewState.editorActive}
      disabled={previewState.editorDisabled}
      preventFocusSteal
      onClick={() => {
        const opening = !previewState.editorActive
        previewState.setEditor(!previewState.editorActive)
        if (opening) refocusEditor = true
      }}>
      {#snippet icon()}
        <PencilIcon />
      {/snippet}
    </Button>
    <Button
      size="sm"
      ariaLabel="Preview view"
      tooltip="Preview view"
      variant={previewState.previewActive ? 'outline' : 'secondary'}
      ariaPressed={previewState.previewActive}
      disabled={previewState.previewDisabled}
      preventFocusSteal
      onClick={() => {
        const closing = previewState.previewActive
        previewState.setPreview(!previewState.previewActive)
        if (closing) editorRef?.focus()
      }}>
      {#snippet icon()}
        <EyeIcon />
      {/snippet}
    </Button>
  {/snippet}

  {#snippet actionButtons()}
    {#if currentType.preview && !context.isMobile}
      {@render previewToggles()}
    {/if}
    {#if currentType.actions && !context.isMobile && editable}
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
        <CopyIcon />
      {/snippet}
    </Button>
    {#if ttsConfigured}
    <Button
      size="sm"
      ariaLabel={speaking ? 'Stop reading' : 'Read aloud'}
      tooltip={speaking ? 'Stop reading' : 'Read aloud'}
      variant={speaking ? 'outline' : 'secondary'}
      ariaPressed={speaking}
      onClick={handleReadAloud}
      disabled={!speaking && content.length === 0}>
      {#snippet icon()}
        {#if speaking}
          <StopIcon />
        {:else}
          <SpeakerIcon />
        {/if}
      {/snippet}
    </Button>
    {/if}
    {#if onClone || cloneDisabled}
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
    {#if versionCount >= 2 && !context.isMobile}
      <Button
        size="sm"
        ariaLabel="Version history"
        tooltip="History"
        onClick={() => (historyOpen = true)}>
        {#snippet icon()}
          {@render historyIcon()}
        {/snippet}
      </Button>
    {/if}
    {#if !context.isMobile}
      <Button
        size="sm"
        ariaLabel="Upload"
        tooltip="Upload"
        onClick={handleUploadClick}
        disabled={!editable}>
        {#snippet icon()}
          {@render uploadIcon()}
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Export"
        tooltip="Export"
        onClick={handleExport}
        disabled={content.length === 0}>
        {#snippet icon()}
          {@render exportIcon()}
        {/snippet}
      </Button>
      {#if currentType.format}
        <Button
          size="sm"
          ariaLabel={currentType.format.title}
          tooltip="Format"
          onClick={formatState.openDialog}
          disabled={!editable}>
          {#snippet icon()}
            {@render formatIcon()}
          {/snippet}
        </Button>
      {/if}
    {/if}
    {#if onTagsSave && editable}
      <Button size="sm" ariaLabel="Edit tags" tooltip="Tags" onClick={() => (tagsOpen = true)}>
        {#snippet icon()}
          <TagsIcon />
        {/snippet}
      </Button>
      <Button size="sm" ariaLabel="Copy sharable link" tooltip="Copy link" onClick={handleCopyLink}>
        {#snippet icon()}
          <LinkIcon />
        {/snippet}
      </Button>
    {/if}
    {#if onShare}
      <Button size="sm" ariaLabel="Share" tooltip="Share" onClick={onShare}>
        {#snippet icon()}
          <ShareIcon />
        {/snippet}
      </Button>
    {/if}
    {#if onDelete}
      <Button
        size="sm"
        ariaLabel="Delete document"
        tooltip="Delete"
        onClick={() => onDelete(document.id)}
        className="text-slate-400 hover:border-rose-500 hover:text-rose-300">
        {#snippet icon()}
          <DeleteIcon />
        {/snippet}
      </Button>
    {/if}
    <Button size="sm" ariaLabel="Reset" tooltip="Reset" onClick={handleResetClick} disabled={!editable || !dirty || saving}>
      {#snippet icon()}
        <RefreshIcon />
      {/snippet}
    </Button>
    <Button
      size="sm"
      ariaLabel="Save"
      tooltip="Save"
      onClick={handleSave}
      disabled={!editable || !dirty || saving}
      variant="primary"
      accent="cyan">
      {#snippet icon()}
        <SaveIcon />
      {/snippet}
    </Button>
  {/snippet}

  {#snippet cloneIcon()}
    <CloneIcon />
  {/snippet}

  {#snippet historyIcon()}
    <HistoryIcon />
  {/snippet}

  {#snippet uploadIcon()}
    <UploadIcon />
  {/snippet}

  {#snippet exportIcon()}
    <ExportIcon />
  {/snippet}

  {#snippet formatIcon()}
    <FormatIcon />
  {/snippet}

  {#snippet menuIcon()}
    <MenuIcon />
  {/snippet}

  {#if context.isMobile}
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex min-w-[min(12rem,60%)] flex-1 items-center gap-2">
          <Button
            size="sm"
            ariaLabel="Open document list"
            tooltip="Document list"
            className="shrink-0"
            preventFocusSteal
            onClick={context.openMobileDrawer}>
            {#snippet icon()}
              {@render menuIcon()}
            {/snippet}
          </Button>
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
        <KebabMenu
          ariaLabel="More actions"
          items={[
            ...(editable
              ? [
                  {
                    id: 'upload',
                    label: 'Upload',
                    onClick: handleUploadClick,
                    icon: uploadIcon,
                  },
                ]
              : []),
            {
              id: 'export',
              label: 'Export',
              onClick: handleExport,
              disabled: content.length === 0,
              icon: exportIcon,
            },
            ...(versionCount >= 2
              ? [
                  {
                    id: 'history',
                    label: 'History',
                    onClick: () => (historyOpen = true),
                    icon: historyIcon,
                  },
                ]
              : []),
            ...(currentType.format && editable
              ? [
                  {
                    id: 'format',
                    label: currentType.format.title,
                    onClick: formatState.openDialog,
                    icon: formatIcon,
                  },
                ]
              : []),
          ]} />
        {#if currentType.preview}
          {@render previewToggles()}
        {/if}
        {@render actionButtons()}
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
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
    class={`mt-3 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 transition focus-within:border-cyan-500 ${previewState.previewMode === 'split' && previewState.showPreview && context.isMobile ? 'flex-col' : ''}`}>
    {#if !previewState.previewOnly}
      <div
        style={previewState.previewMode === 'split' && previewState.showPreview ? `flex-basis: ${previewState.editorWidthPct}%` : 'flex: 1'}
        class="min-h-0 min-w-0 overflow-hidden">
        <LazyCodeEditor
          bind:this={editorRef}
          bind:content
          {docType}
{editable}
          autoFocus={focusOnMount || refocusEditor}
          onAutoFocused={() => (refocusEditor = false)}
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
        orientation={context.isMobile ? 'horizontal' : 'vertical'}
        lineClass={context.isMobile ? 'border-t border-slate-700' : 'border-l border-slate-700'}
        onChange={(value: number) => (previewState.editorWidthPct = value)}
        ariaLabel="Resize editor and preview panes" />
    {/if}
    {#if previewState.showPreview && currentType.preview}
      <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
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

  <audio
    bind:this={audioRef}
    class="hidden"
    onended={() => playNextSegment()}
    onerror={() => {
      toast.error('Failed to play a segment')
      playNextSegment()
    }}
    onpause={() => {
      if (ttsQueue.length === 0) {
        speaking = false
      }
    }}></audio>

  <div class="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
    {#if document.updatedAt}
      <span class="min-w-0">
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
      {#if !editable}
        <span class="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-400">Read only</span>
      {/if}
      {#if refreshing}
        <span class="text-slate-400">Refreshing...</span>
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
    show={formatState.open}
    title={currentType.format.title}
    hasIndent={currentType.format.hasIndent ?? true}
    onConfirm={indent => void formatState.confirm(indent)}
    onCancel={formatState.cancel} />
{/if}

{#if versionCount >= 2}
  <HistoryDialog
    open={historyOpen}
    documentId={document.id}
    currentContent={content}
    currentType={docType}
    hasUnsavedChanges={dirty}
    isMobile={context.isMobile}
    onClose={() => (historyOpen = false)}
    onRestore={version => {
      content = version.content
      docType = version.documentType
      historyOpen = false
      if (content !== document.content || docType !== document.documentType) {
        toast.success('Version restored — review and save')
      }
    }} />
{/if}