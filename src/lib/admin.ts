export class AdminAuthError extends Error {
  constructor(message = 'Admin authentication required') {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export interface AdminSetting {
  key: string
  label: string
  description: string
  defaultValue: number
  envKey: string
  min: number
  max: number
  value: number
  source: 'database' | 'environment' | 'default'
}

export interface AdminDocumentSummary {
  id: string
  name: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  contentSize: number
}

export interface AdminDocument extends AdminDocumentSummary {
  content: string
}

export interface AdminDocumentListResponse {
  documents: AdminDocumentSummary[]
  total: number
  hasMore: boolean
}

export interface AdminSessionInfo {
  authenticated: boolean
  configured: boolean
}

const BASE_PATH = '/api/admin'

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (response.status === 401) {
    throw new AdminAuthError()
  }
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body !== null && typeof body.error === 'string' ? body.error : fallback)
  }
  return body as T
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  await parseResponse<{ ok: boolean }>(response, 'Failed to sign in')
}

export async function fetchAdminSession(): Promise<AdminSessionInfo> {
  const response = await fetch(`${BASE_PATH}/session`)
  return parseResponse<AdminSessionInfo>(response, 'Failed to check session')
}

export async function logout(): Promise<void> {
  const response = await fetch(`${BASE_PATH}/logout`, { method: 'POST' })
  await parseResponse<{ ok: boolean }>(response, 'Failed to sign out')
}

export async function fetchAdminSettings(): Promise<AdminSetting[]> {
  const response = await fetch(`${BASE_PATH}/settings`)
  const body = await parseResponse<{ settings: AdminSetting[] }>(response, 'Failed to load settings')
  return body.settings
}

export async function updateAdminSettings(
  settings: Array<{ key: string; value: number | null }>,
): Promise<AdminSetting[]> {
  const response = await fetch(`${BASE_PATH}/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
  const body = await parseResponse<{ settings: AdminSetting[] }>(response, 'Failed to save settings')
  return body.settings
}

export async function resetAdminSetting(key: string): Promise<AdminSetting[]> {
  return updateAdminSettings([{ key, value: null }])
}

export async function fetchAdminDocuments(
  options: {
    search?: string
    searchKeys?: string[]
    limit?: number
    offset?: number
    sortBy?: string
    order?: 'asc' | 'desc'
  } = {},
): Promise<AdminDocumentListResponse> {
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
  const url = queryString ? `${BASE_PATH}/documents?${queryString}` : `${BASE_PATH}/documents`

  const response = await fetch(url)
  const body = await parseResponse<AdminDocumentListResponse>(response, 'Failed to load documents')
  return body
}

export async function renameAdminDocument(id: string, name: string): Promise<AdminDocument> {
  const response = await fetch(`${BASE_PATH}/documents/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const body = await parseResponse<{ document: AdminDocument }>(response, 'Failed to rename document')
  return body.document
}

export async function deleteAdminDocument(id: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/documents/${id}`, { method: 'DELETE' })
  if (response.status === 401) {
    throw new AdminAuthError()
  }
  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete document')
  }
}
