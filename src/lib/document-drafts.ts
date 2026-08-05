const STORAGE_KEY_PREFIX = 'share-text:draft:'
const memoryDrafts = new Map<string, string>()
const MAX_MEMORY_DRAFTS = 50

function pruneMemoryDrafts() {
  if (memoryDrafts.size > MAX_MEMORY_DRAFTS) {
    const oldest = Array.from(memoryDrafts.keys()).slice(0, memoryDrafts.size - MAX_MEMORY_DRAFTS)
    for (const key of oldest) {
      memoryDrafts.delete(key)
    }
  }
}

export function loadDraft(id: string): string | null {
  if (typeof localStorage === 'undefined') {
    return memoryDrafts.get(id) ?? null
  }
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + id) ?? memoryDrafts.get(id) ?? null
  } catch (error) {
    console.error('Failed to load draft from localStorage', { id, error })
    return memoryDrafts.get(id) ?? null
  }
}

export function saveDraft(id: string, content: string) {
  if (typeof localStorage === 'undefined') {
    memoryDrafts.set(id, content)
    pruneMemoryDrafts()
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, content)
    memoryDrafts.delete(id)
  } catch (error) {
    memoryDrafts.set(id, content)
    pruneMemoryDrafts()
    console.error('Failed to save draft to localStorage', { id, error })
  }
}

export function clearDraft(id: string) {
  memoryDrafts.delete(id)
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id)
  } catch (error) {
    console.error('Failed to clear draft from localStorage', { id, error })
  }
}
