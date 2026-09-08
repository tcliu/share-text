import type { AdminDocumentSummary } from './admin'
import type { ShareTextI18n } from './i18n.svelte'

export interface OwnedDocumentListResponse {
  documents: AdminDocumentSummary[]
  total: number
  hasMore: boolean
}

export class OwnedDocumentsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OwnedDocumentsAuthError'
  }
}

async function parseResponse<T>(response: Response, fallback: string, i18n: ShareTextI18n): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (response.status === 401) {
    throw new OwnedDocumentsAuthError(i18n.t('admin.auth.required'))
  }
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body !== null && typeof body.error === 'string' ? body.error : fallback)
  }
  return body as T
}

export async function fetchOwnedDocuments(
  options: {
    search?: string
    searchKeys?: string[]
    limit?: number
    offset?: number
    sortBy?: string
    order?: 'asc' | 'desc'
  } = {},
  i18n: ShareTextI18n,
): Promise<OwnedDocumentListResponse> {
  const { search, searchKeys, limit, offset = 0, sortBy, order } = options
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
  if (sortBy) {
    params.set('sortBy', sortBy)
  }
  if (order) {
    params.set('order', order)
  }
  const queryString = params.toString()
  const url = queryString ? `/api/user/documents?${queryString}` : '/api/user/documents'
  const response = await fetch(url)
  return parseResponse<OwnedDocumentListResponse>(response, i18n.t('admin.auth.toast.loadDocuments'), i18n)
}
