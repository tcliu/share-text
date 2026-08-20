import { replaceState } from '$app/navigation'
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
  replaceState(url, page.state)
}

export function usePreviewMode(hasPreview: () => boolean) {
  let previewMode = $state<PreviewMode>(previewModeFromUrl())

  $effect(() => {
    previewMode = previewModeFromUrl()
  })

  let editorWidthPct = $state(loadEditorPreviewSplit())

  const showPreview = $derived(previewMode !== 'editor' && hasPreview())
  const previewOnly = $derived(previewMode === 'preview' && showPreview)
  const editorActive = $derived(previewMode !== 'preview')
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

  return {
    get previewMode() { return previewMode },
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
  }
}
