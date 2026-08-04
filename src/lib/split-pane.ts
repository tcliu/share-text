const STORAGE_KEY = 'share-text:split-pane-width'
export const SPLIT_PANE_MIN_WIDTH = 160
export const SPLIT_PANE_MAX_WIDTH = 480
export const SPLIT_PANE_DEFAULT_WIDTH = 288

let memoryWidth = SPLIT_PANE_DEFAULT_WIDTH

function clampWidth(width: number) {
  if (Number.isNaN(width)) {
    return SPLIT_PANE_DEFAULT_WIDTH
  }
  return Math.min(SPLIT_PANE_MAX_WIDTH, Math.max(SPLIT_PANE_MIN_WIDTH, width))
}

export function loadSplitPaneWidth(): number {
  if (typeof localStorage === 'undefined') {
    return memoryWidth
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return memoryWidth
    }
    memoryWidth = clampWidth(Number.parseInt(raw, 10))
    return memoryWidth
  } catch (error) {
    console.error('Failed to load split pane width from localStorage', { error })
    return memoryWidth
  }
}

export function saveSplitPaneWidth(width: number) {
  memoryWidth = clampWidth(width)
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(memoryWidth))
  } catch (error) {
    console.error('Failed to save split pane width to localStorage', { error })
  }
}
