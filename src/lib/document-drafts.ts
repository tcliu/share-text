const STORAGE_KEY_PREFIX = 'share-text:draft:'

export function loadDraft(id: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + id)
  } catch {
    return null
  }
}

export function saveDraft(id: string, content: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, content)
  } catch {
    // Ignore quota or privacy-mode errors; the in-memory editor still works.
  }
}

export function clearDraft(id: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id)
  } catch {
    // Ignore storage errors.
  }
}
