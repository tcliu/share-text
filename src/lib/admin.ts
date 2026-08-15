import type { Tag } from './tag-colors'

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
  documentType: string
  tags: Tag[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  contentSize: number
  isPublic: boolean
}

export interface AdminDocument extends AdminDocumentSummary {
  content: string
}

export interface AdminDocumentListResponse {
  documents: AdminDocumentSummary[]
  total: number
  hasMore: boolean
}

export type AdminUserStatus = 'active' | 'inactive'

export interface AdminUser {
  id: number
  username: string
  email: string
  status: AdminUserStatus
  createdAt: string
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
  hasMore: boolean
}

export interface AdminDocumentExportRecord {
  key: string
  name: string
  content: string
  documentType: string
  tags: Tag[]
  isPublic: boolean
}

export interface AdminUserExportRecord {
  username: string
  email: string
  status: AdminUserStatus
  passwordHash: string
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

export async function login(username: string, password: string, rememberMe = false): Promise<void> {
  const response = await fetch(`${BASE_PATH}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe }),
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

export async function updateAdminDocument(
  id: string,
  changes: {
    name?: string
    updatedBy?: string
    createdBy?: string
    key?: string
    isPublic?: boolean
    content?: string
    documentType?: string
  },
): Promise<AdminDocument> {
  const response = await fetch(`${BASE_PATH}/documents/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  })
  const body = await parseResponse<{ document: AdminDocument }>(response, 'Failed to update document')
  return body.document
}

export async function createAdminDocument(input: {
  name: string
  content: string
  documentType?: string
}): Promise<AdminDocument> {
  const response = await fetch(`${BASE_PATH}/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseResponse<{ document: AdminDocument }>(response, 'Failed to create document')
  return body.document
}

export async function fetchAdminDocument(id: string): Promise<AdminDocument> {
  const response = await fetch(`${BASE_PATH}/documents/${id}`)
  const body = await parseResponse<{ document: AdminDocument }>(response, 'Failed to load document')
  return body.document
}

export async function deleteAdminDocument(id: string): Promise<void> {
  const response = await fetch(`${BASE_PATH}/documents/${id}`, { method: 'DELETE' })
  await parseResponse(response, 'Failed to delete document')
}

export async function importAdminDocuments(records: unknown[]): Promise<AdminDocumentSummary[]> {
  const response = await fetch(`${BASE_PATH}/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  const body = await parseResponse<{ documents: AdminDocumentSummary[] }>(response, 'Failed to import documents')
  return body.documents
}

export async function fetchAdminUsers(
  options: {
    search?: string
    searchKeys?: string[]
    limit?: number
    offset?: number
    sortBy?: string
    order?: 'asc' | 'desc'
  } = {},
): Promise<AdminUserListResponse> {
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
  const url = queryString ? `${BASE_PATH}/users?${queryString}` : `${BASE_PATH}/users`

  const response = await fetch(url)
  const body = await parseResponse<AdminUserListResponse>(response, 'Failed to load users')
  return body
}

export async function createAdminUser(input: {
  username: string
  email: string
  password: string
  status?: AdminUserStatus
}): Promise<AdminUser> {
  const response = await fetch(`${BASE_PATH}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseResponse<{ user: AdminUser }>(response, 'Failed to create user')
  return body.user
}

export async function updateAdminUser(
  id: number,
  changes: { username?: string; email?: string; password?: string; status?: AdminUserStatus },
): Promise<AdminUser> {
  const response = await fetch(`${BASE_PATH}/users/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  })
  const body = await parseResponse<{ user: AdminUser }>(response, 'Failed to update user')
  return body.user
}

export async function deleteAdminUser(id: number): Promise<void> {
  const response = await fetch(`${BASE_PATH}/users/${id}`, { method: 'DELETE' })
  await parseResponse(response, 'Failed to delete user')
}

export async function importAdminUsers(records: unknown[]): Promise<AdminUser[]> {
  const response = await fetch(`${BASE_PATH}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  const body = await parseResponse<{ users: AdminUser[] }>(response, 'Failed to import users')
  return body.users
}

export async function exportAdminDocuments(ids?: string[]): Promise<AdminDocumentExportRecord[]> {
  const params = new URLSearchParams()
  if (ids && ids.length > 0) {
    params.set('ids', ids.join(','))
  }
  const queryString = params.toString()
  const url = queryString ? `${BASE_PATH}/documents/export?${queryString}` : `${BASE_PATH}/documents/export`

  const response = await fetch(url)
  return parseResponse<AdminDocumentExportRecord[]>(response, 'Failed to export documents')
}

export async function exportAdminUsers(ids?: number[]): Promise<AdminUserExportRecord[]> {
  const params = new URLSearchParams()
  if (ids && ids.length > 0) {
    params.set('ids', ids.join(','))
  }
  const queryString = params.toString()
  const url = queryString ? `${BASE_PATH}/users/export?${queryString}` : `${BASE_PATH}/users/export`

  const response = await fetch(url)
  return parseResponse<AdminUserExportRecord[]>(response, 'Failed to export users')
}
