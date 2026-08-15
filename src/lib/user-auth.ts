import type { User } from './documents'

export interface AdminIdentity {
  username: string
}

export interface UserSessionInfo {
  user: User | null
  admin: AdminIdentity | null
}

export type LoginResult = { kind: 'user'; user: User } | { kind: 'admin' }

const AUTH_PATH = '/api/auth'

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body !== null && typeof body.error === 'string' ? body.error : fallback)
  }
  return body as T
}

export async function login(identifier: string, password: string, rememberMe = false): Promise<LoginResult> {
  const response = await fetch(`${AUTH_PATH}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password, rememberMe }),
  })
  const body = await parseResponse<{ user?: User | null; admin?: boolean }>(response, 'Failed to sign in')
  if (body.admin) {
    return { kind: 'admin' }
  }
  if (body.user) {
    return { kind: 'user', user: body.user }
  }
  throw new Error('Unexpected login response')
}

export async function register(username: string, email: string, password: string): Promise<User> {
  const response = await fetch(`${AUTH_PATH}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const body = await parseResponse<{ user: User }>(response, 'Failed to create account')
  return body.user
}

export async function logout(): Promise<void> {
  const response = await fetch(`${AUTH_PATH}/logout`, { method: 'POST' })
  await parseResponse<{ ok: boolean }>(response, 'Failed to sign out')
}

export async function fetchUserSession(): Promise<UserSessionInfo> {
  const response = await fetch(`${AUTH_PATH}/session`)
  const body = await parseResponse<{ user?: User | null; admin?: AdminIdentity | null }>(response, 'Failed to check session')
  return { user: body.user ?? null, admin: body.admin ?? null }
}

export async function searchUsers(query: string): Promise<User[]> {
  const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
  const body = await parseResponse<{ users: User[] }>(response, 'Failed to search users')
  return Array.isArray(body.users) ? body.users : []
}
