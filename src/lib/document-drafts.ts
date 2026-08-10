const STORAGE_KEY_PREFIX = 'share-text:draft:'
const memoryDrafts = new Map<string, DraftData>()
const MAX_MEMORY_DRAFTS = 50

interface DraftData {
  content: string
  docType?: string
}

function pruneMemoryDrafts() {
  if (memoryDrafts.size > MAX_MEMORY_DRAFTS) {
    const oldest = Array.from(memoryDrafts.keys()).slice(0, memoryDrafts.size - MAX_MEMORY_DRAFTS)
    for (const key of oldest) {
      memoryDrafts.delete(key)
    }
  }
}

function serializeDraft(draft: DraftData): string {
  return JSON.stringify(draft)
}

// Parses a stored draft. Old plain-string drafts (pre-typed format) are treated
// as content-only and still load correctly.
function deserializeDraft(raw: string): DraftData | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
      return { content: parsed.content, docType: typeof parsed.docType === 'string' ? parsed.docType : undefined }
    }
  } catch {
    // not JSON; treat as legacy plain content
  }
  return { content: raw, docType: undefined }
}

function readDraft(id: string): DraftData | null {
  if (typeof localStorage === 'undefined') {
    return memoryDrafts.get(id) ?? null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id)
    if (raw === null) {
      return memoryDrafts.get(id) ?? null
    }
    return deserializeDraft(raw)
  } catch (error) {
    console.error('Failed to load draft from localStorage', { id, error })
    return memoryDrafts.get(id) ?? null
  }
}

export function loadDraft(id: string): string | null {
  return readDraft(id)?.content ?? null
}

export function loadDraftDocType(id: string): string | null {
  return readDraft(id)?.docType ?? null
}

export function saveDraft(id: string, content: string, docType?: string) {
  const draft: DraftData = { content, docType }
  if (typeof localStorage === 'undefined') {
    memoryDrafts.set(id, draft)
    pruneMemoryDrafts()
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, serializeDraft(draft))
    memoryDrafts.delete(id)
  } catch (error) {
    memoryDrafts.set(id, draft)
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
