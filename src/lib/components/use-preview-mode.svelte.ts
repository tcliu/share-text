import { page } from '$app/state'
import {
  loadEditorPreviewSplit,
  saveEditorPreviewSplit,
} from '$lib/editor-preview-split'

export type PreviewMode = 'editor' | 'split' | 'preview'

function previewModeFromUrl(): PreviewMode {
  const params = page.url.searchParams
  if (params.get('preview') !== 'true') return 'editor'
  if (params.get('editor') === 'false') return 'preview'
  return 'split'
}

function applyPreviewMode(mode: PreviewMode) {
  const url = new URL(page.url)
  if (mode === 'editor') {
    url.searchParams.delete('preview')
    url.searchParams.delete('editor')
  } else {
    url.searchParams.set('preview', 'true')
    if (mode === 'preview') {
      url.searchParams.set('editor', 'false')
    } else {
      url.searchParams.delete('editor')
    }
  }
  history.replaceState(history.state, '', url)
}

export function usePreviewMode(hasPreview: () => boolean, isMobile: () => boolean) {
  let previewMode = $state<PreviewMode>(previewModeFromUrl())

  $effect(() => {
    previewMode = previewModeFromUrl()
  })

  let editorWidthPct = $state(loadEditorPreviewSplit())

  // On mobile there is no split view: any non-editor mode renders preview-only.
  const effectiveMode = $derived(isMobile() && previewMode !== 'editor' ? 'preview' : previewMode)

  const showPreview = $derived(effectiveMode !== 'editor' && hasPreview())
  const previewOnly = $derived(effectiveMode === 'preview' && showPreview)
  const editorActive = $derived(effectiveMode !== 'preview')
  const previewActive = $derived(showPreview)
  const editorDisabled = $derived(editorActive && !previewActive)
  const previewDisabled = $derived(previewActive && !editorActive)

  function setEditor(on: boolean) {
    const mode: PreviewMode = on ? 'split' : 'preview'
    previewMode = mode
    applyPreviewMode(mode)
  }

  function setPreview(on: boolean) {
    const mode: PreviewMode = on ? 'split' : 'editor'
    previewMode = mode
    applyPreviewMode(mode)
  }

  function togglePreview() {
    const mode: PreviewMode = effectiveMode === 'editor' ? 'preview' : 'editor'
    previewMode = mode
    applyPreviewMode(mode)
  }

  return {
    get previewMode() { return effectiveMode },
    get showPreview() { return showPreview },
    get previewOnly() { return previewOnly },
    get editorActive() { return editorActive },
    get previewActive() { return previewActive },
    get editorDisabled() { return editorDisabled },
    get previewDisabled() { return previewDisabled },
    get editorWidthPct() { return editorWidthPct },
    set editorWidthPct(value: number) {
      editorWidthPct = value
      saveEditorPreviewSplit(value)
    },
    setEditor,
    setPreview,
    togglePreview,
  }
}
