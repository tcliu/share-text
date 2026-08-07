import { page } from '$app/state'

export type PreviewMode = 'editor' | 'split' | 'preview'

const PREVIEW_MODES: PreviewMode[] = ['editor', 'split', 'preview']
const PREVIEW_MODE_LABELS: Record<PreviewMode, string> = {
  editor: 'Editor view',
  split: 'Split view',
  preview: 'Preview view',
}

export const SPLIT_MIN_PCT = 10

function previewModeFromUrl(): PreviewMode {
  const params = page.url.searchParams
  if (params.get('preview') !== 'true') return 'editor'
  if (params.get('editor') === 'false') return 'preview'
  return 'split'
}

export function usePreviewMode(hasPreview: () => boolean) {
  let previewMode = $state<PreviewMode>(previewModeFromUrl())

  $effect(() => {
    previewMode = previewModeFromUrl()
  })

  let editorWidthPct = $state(50)

  const showPreview = $derived(previewMode !== 'editor' && hasPreview())
  const previewOnly = $derived(previewMode === 'preview' && showPreview)
  const modeLabel = $derived(PREVIEW_MODE_LABELS[previewMode])

  function cyclePreviewMode() {
    const index = PREVIEW_MODES.indexOf(previewMode)
    previewMode = PREVIEW_MODES[(index + 1) % PREVIEW_MODES.length]
    const url = new URL(page.url)
    if (previewMode === 'editor') {
      url.searchParams.delete('preview')
      url.searchParams.delete('editor')
    } else {
      url.searchParams.set('preview', 'true')
      if (previewMode === 'preview') {
        url.searchParams.set('editor', 'false')
      } else {
        url.searchParams.delete('editor')
      }
    }
    history.replaceState(history.state, '', url)
  }

  return {
    get previewMode() { return previewMode },
    get showPreview() { return showPreview },
    get previewOnly() { return previewOnly },
    get modeLabel() { return modeLabel },
    get editorWidthPct() { return editorWidthPct },
    set editorWidthPct(value: number) { editorWidthPct = value },
    cyclePreviewMode,
  }
}
