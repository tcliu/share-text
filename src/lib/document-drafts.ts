const STORAGE_KEY_PREFIX = 'share-text:draft:'

export function loadDraft(id: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + id)
  } catch (error) {
    console.error('Failed to load draft from localStorage', { id, error })
    return null
  }
}

export function saveDraft(id: string, content: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, content)
  } catch (error) {
    console.error('Failed to save draft to localStorage', { id, error })
  }
}

export function clearDraft(id: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id)
  } catch (error) {
    console.error('Failed to clear draft from localStorage', { id, error })
  }
}
