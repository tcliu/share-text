export interface DocumentSummary {
  id: string
  name: string
  updatedAt: string
  updatedBy: string
}

export interface Document extends DocumentSummary {
  content: string
}

export interface DocumentListResponse {
  documents: DocumentSummary[]
  hasMore: boolean
}

const BASE_PATH = '/api/documents'

export async function fetchDocumentSummaries(options: { limit?: number; offset?: number } = {}): Promise<DocumentListResponse> {
  const { limit, offset = 0 } = options
  const params = new URLSearchParams()
  if (limit !== undefined) {
    params.set('limit', limit.toString())
  }
  if (offset > 0) {
    params.set('offset', offset.toString())
  }

  const queryString = params.toString()
  const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH

  const response = await fetch(url)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to load documents')
  }
  return {
    documents: Array.isArray(body.documents) ? body.documents : [],
    hasMore: Boolean(body.hasMore),
  }
}

export async function fetchDocument(id: string): Promise<Document | null> {
  const response = await fetch(`${BASE_PATH}/${id}`)
  const body = await response.json().catch(() => ({}))
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Failed to load document')
  }
  return body.document ?? null
}

export async function createDocument(): Promise<Document> {
  const response = await fetch(BASE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to create document')
  }
  return body.document
}

export async function updateDocument(
  id: string,
  options: { name?: string; content?: string },
): Promise<Document> {
  const response = await fetch(`${BASE_PATH}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to save document')
  }
  return body.document
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Failed to delete document')
  }
}
