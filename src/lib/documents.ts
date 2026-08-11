import type { Tag } from './tag-colors'

export interface DocumentSummary {
  id: string
  name: string
  documentType: string
  tags: Tag[]
  updatedAt: string
  updatedBy: string
}

export interface OwnedDocumentSummary extends DocumentSummary {
  owned: boolean
}

export interface Document extends DocumentSummary {
  content: string
}

export interface DocumentVersionSummary {
  id: string
  documentId: string
  documentType: string
  updatedBy: string
  createdAt: string
  contentSize: number
}

export interface DocumentVersion extends DocumentVersionSummary {
  content: string
}

export interface DocumentListResponse {
  documents: OwnedDocumentSummary[]
  hasMore: boolean
}

const BASE_PATH = '/api/documents'

export async function fetchDocumentSummaries(
  options: { search?: string; searchKeys?: string[]; limit?: number; offset?: number } = {},
): Promise<DocumentListResponse> {
  const { search, searchKeys, limit, offset = 0 } = options
  const params = new URLSearchParams()
  if (search) {
    params.set('search', search)
  }
  if (searchKeys && searchKeys.length > 0) {
    params.set('search-keys', searchKeys.join(','))
  }
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

export async function createDocument(options: { name?: string; content?: string; documentType?: string } = {}): Promise<Document> {
  const response = await fetch(BASE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to create document')
  }
  return body.document
}

export async function updateDocument(
  id: string,
  options: { name?: string; content?: string; documentType?: string; tags?: Tag[] },
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

export async function fetchDocumentVersions(id: string): Promise<DocumentVersionSummary[]> {
  const response = await fetch(`${BASE_PATH}/${id}/versions`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to load version history')
  }
  return Array.isArray(body.versions) ? body.versions : []
}

export async function fetchDocumentVersion(id: string, versionId: string): Promise<DocumentVersion | null> {
  const response = await fetch(`${BASE_PATH}/${id}/versions/${versionId}`)
  const body = await response.json().catch(() => ({}))
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Failed to load version')
  }
  return body.version ?? null
}
