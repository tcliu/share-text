const STORAGE_KEY = 'share-text:editor-preview-split'
export const EDITOR_PREVIEW_MIN_PCT = 10
export const EDITOR_PREVIEW_MAX_PCT = 90
export const EDITOR_PREVIEW_DEFAULT_PCT = 50

let memorySplit = EDITOR_PREVIEW_DEFAULT_PCT

function clampSplit(pct: number) {
  if (Number.isNaN(pct)) {
    return EDITOR_PREVIEW_DEFAULT_PCT
  }
  return Math.min(EDITOR_PREVIEW_MAX_PCT, Math.max(EDITOR_PREVIEW_MIN_PCT, pct))
}

export function loadEditorPreviewSplit(): number {
  if (typeof localStorage === 'undefined') {
    return memorySplit
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return memorySplit
    }
    memorySplit = clampSplit(Number.parseInt(raw, 10))
    return memorySplit
  } catch (error) {
    console.error('Failed to load editor preview split from localStorage', { error })
    return memorySplit
  }
}

export function saveEditorPreviewSplit(pct: number) {
  const clamped = clampSplit(Math.round(pct))
  memorySplit = clamped
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped))
  } catch (error) {
    console.error('Failed to save editor preview split to localStorage', { error })
  }
}