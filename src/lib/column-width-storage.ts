const STORAGE_KEY_PREFIX = 'share-text:column-widths:'

let memoryWidths = new Map<string, number[]>()

function clampWidths(widths: number[]): number[] {
  return widths.map((w) => {
    if (Number.isNaN(w)) {
      return 128
    }
    return Math.round(w)
  })
}

export function loadColumnWidths(key: string): number[] | null {
  const fallback = memoryWidths.get(key)
  if (typeof localStorage === 'undefined') {
    return fallback ?? null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key)
    if (raw === null) {
      return fallback ?? null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return fallback ?? null
    }
    const widths = clampWidths(parsed.filter((w): w is number => typeof w === 'number'))
    memoryWidths.set(key, widths)
    return widths
  } catch (error) {
    console.error('Failed to load column widths from localStorage', { key, error })
    return fallback ?? null
  }
}

export function saveColumnWidths(key: string, widths: number[]) {
  const stored = clampWidths(widths)
  memoryWidths.set(key, stored)
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(stored))
  } catch (error) {
    console.error('Failed to save column widths to localStorage', { key, error })
  }
}
