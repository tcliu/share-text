import { getDb } from './db'
import { isUniqueViolation } from './db-errors'
import { toIsoString } from './iso-string'
import { hashPassword, isPasswordHash, verifyPassword } from './password'
import { appendSearchConditions } from './sql-search'

export const MAX_USERNAME_LENGTH = 32
export const MAX_EMAIL_LENGTH = 254
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type UserStatus = 'active' | 'inactive'

export interface User {
  id: number
  username: string
  email: string
  status: UserStatus
}

export interface AdminUser {
  id: number
  username: string
  email: string
  status: UserStatus
  createdAt: string
}

interface UserRow {
  id: string | number
  username: string
  email: string
  status: string | null
}

interface UserWithHashRow extends UserRow {
  password_hash: string
}

interface UserAdminRow extends UserRow {
  created_at: Date | string
}

function toUser(row: UserRow): User {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    status: row.status === 'inactive' ? 'inactive' : 'active',
  }
}

function toAdminUser(row: UserAdminRow): AdminUser {
  return { ...toUser(row), createdAt: toIsoString(row.created_at) }
}

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase()
  if (!username) {
    throw new Error('username is required')
  }
  if (username.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(username)) {
    throw new Error(`username must be 3-${MAX_USERNAME_LENGTH} lowercase letters, numbers, or underscores`)
  }
  return username
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!email) {
    throw new Error('email is required')
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new Error('email must be a valid email address')
  }
  return email
}

export function normalizeStatus(value: string): UserStatus {
  if (value === 'active' || value === 'inactive') {
    return value
  }
  throw new Error('status must be active or inactive')
}

export async function createUser(input: { username: string; email: string; password: string }): Promise<User> {
  const username = normalizeUsername(input.username)
  const email = normalizeEmail(input.email)
  if (!input.password) {
    throw new Error('password is required')
  }
  const passwordHash = await hashPassword(input.password)
  const db = await getDb()
  try {
    const result = await db.query<UserRow>(
      `insert into users (username, email, password_hash, created_at)
       values ($1, $2, $3, current_timestamp)
       returning id, username, email, status`,
      [username, email, passwordHash],
    )
    return toUser(result.rows[0])
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error('username or email is already taken')
    }
    throw error
  }
}

export const MAX_IMPORT_RECORDS = 500

export interface ImportUserRecord {
  username: string
  email: string
  password?: string
  passwordHash?: string
  status?: string
}

/**
 * Bulk-create users for the admin import dialog. Every record is normalized
 * and its password resolved up front (hashing is expensive, so it happens
 * outside the transaction), then the inserts run in a single transaction so an
 * invalid or duplicate record aborts the whole import (all-or-nothing). A
 * record carries either a plaintext `password` (hashed here) or a pre-hashed
 * `passwordHash` (verified and stored as-is, so exports round-trip).
 */
export async function importUsersForAdmin(records: ImportUserRecord[]): Promise<AdminUser[]> {
  if (records.length === 0) {
    throw new Error('No records to import')
  }
  const prepared = await Promise.all(
    records.map(async (record, index) => {
      let username: string
      let email: string
      let status: UserStatus
      try {
        username = normalizeUsername(record.username)
        email = normalizeEmail(record.email)
        status = normalizeStatus(record.status ?? 'active')
      } catch (error) {
        throw new Error(`record ${index + 1}: ${error instanceof Error ? error.message : 'invalid record'}`)
      }
      let passwordHash: string
      if (record.passwordHash !== undefined && record.password !== undefined) {
        throw new Error(`record ${index + 1}: provide only one of password or passwordHash`)
      }
      if (record.passwordHash !== undefined) {
        if (!isPasswordHash(record.passwordHash)) {
          throw new Error(`record ${index + 1}: invalid passwordHash`)
        }
        passwordHash = record.passwordHash
      } else if (record.password) {
        passwordHash = await hashPassword(record.password)
      } else {
        throw new Error(`record ${index + 1}: password or passwordHash is required`)
      }
      return { username, email, status, passwordHash }
    }),
  )
  const seenUsernames = new Set<string>()
  const seenEmails = new Set<string>()
  for (let i = 0; i < prepared.length; i++) {
    const { username, email } = prepared[i]
    if (seenUsernames.has(username) || seenEmails.has(email)) {
      throw new Error(`record ${i + 1}: username or email is already taken`)
    }
    seenUsernames.add(username)
    seenEmails.add(email)
  }
  const db = await getDb()
  return db.transaction(async query => {
    const created: AdminUser[] = []
    for (let i = 0; i < prepared.length; i++) {
      const { username, email, status, passwordHash } = prepared[i]
      try {
        const result = await query<UserAdminRow>(
          `insert into users (username, email, password_hash, status, created_at)
           values ($1, $2, $3, $4, current_timestamp)
           returning id, username, email, status, created_at`,
          [username, email, passwordHash, status],
        )
        created.push(toAdminUser(result.rows[0]))
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Error(`record ${i + 1}: username or email is already taken`)
        }
        throw error
      }
    }
    return created
  })
}

export interface AdminUserExportRecord {
  username: string
  email: string
  status: UserStatus
  passwordHash: string
}

interface AdminUserExportRow extends UserRow {
  password_hash: string
}

/**
 * Export users for the admin export action, shaped to match the admin import
 * record format. The scrypt `passwordHash` is exported (never a plaintext
 * password) so an export re-imports directly with credentials preserved. When
 * `ids` is provided only those users are exported; otherwise every user is.
 */
export async function exportUsersForAdmin(ids?: number[]): Promise<AdminUserExportRecord[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  if (ids && ids.length > 0) {
    const placeholders = ids.map((_, index) => `$${params.length + index + 1}`)
    conditions.push(`id in (${placeholders.join(', ')})`)
    params.push(...ids)
  }
  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''
  const db = await getDb()
  const result = await db.query<AdminUserExportRow>(
    `select id, username, email, status, password_hash from users${whereClause} order by username asc`,
    params,
  )
  return result.rows.map(row => ({
    username: row.username,
    email: row.email,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    passwordHash: row.password_hash,
  }))
}

export async function findUserById(id: number): Promise<User | null> {
  const db = await getDb()
  const result = await db.query<UserRow>('select id, username, email, status from users where id = $1', [id])
  const row = result.rows[0]
  return row ? toUser(row) : null
}

export async function findAdminUserById(id: number): Promise<AdminUser | null> {
  const db = await getDb()
  const result = await db.query<UserAdminRow>(
    'select id, username, email, status, created_at from users where id = $1',
    [id],
  )
  const row = result.rows[0]
  return row ? toAdminUser(row) : null
}

export async function findUserByCredentials(identifier: string, password: string): Promise<User | null> {
  const value = identifier.trim().toLowerCase()
  if (!value || !password) {
    return null
  }
  const db = await getDb()
  const result = await db.query<UserWithHashRow>(
    'select id, username, email, status, password_hash from users where username = $1 or email = $2',
    [value, value],
  )
  const row = result.rows[0]
  if (!row || row.status === 'inactive' || !(await verifyPassword(password, row.password_hash))) {
    return null
  }
  return toUser(row)
}

export async function findUsersByUsernameOrEmail(values: string[]): Promise<User[]> {
  if (values.length === 0) {
    return []
  }
  const db = await getDb()
  const params: string[] = []
  const conditions = values.map(value => {
    const normalized = value.trim().toLowerCase()
    params.push(normalized)
    params.push(normalized)
    return `(username = $${params.length - 1} or email = $${params.length})`
  })
  const result = await db.query<UserRow>(
    `select id, username, email, status from users where (${conditions.join(' or ')}) and status = 'active'`,
    params,
  )
  return result.rows.map(toUser)
}

export async function searchUsers(query: string, limit = 10): Promise<User[]> {
  const value = query.trim().toLowerCase()
  if (!value) {
    return []
  }
  const db = await getDb()
  const result = await db.query<UserRow>(
    `select id, username, email, status from users
     where (lower(username) like $1 or lower(email) like $2) and status = 'active'
     order by username asc limit $3`,
    [`${value}%`, `${value}%`, limit],
  )
  return result.rows.map(toUser)
}

const ADMIN_USER_SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  username: 'username',
  email: 'email',
  status: 'status',
  createdAt: 'created_at',
}

const ADMIN_USER_SEARCH_COLUMNS: Record<string, string> = {
  username: 'username',
  email: 'email',
}

export interface ListUsersOptions {
  search?: string
  searchKeys?: string[]
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export async function listUsers(options: ListUsersOptions = {}) {
  const { search, searchKeys, limit, offset = 0, sortBy, order } = options
  const sortColumn = ADMIN_USER_SORT_COLUMNS[sortBy ?? 'id'] ?? ADMIN_USER_SORT_COLUMNS.id
  const sortDir = order === 'asc' ? 'asc' : 'desc'
  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    appendSearchConditions({
      search,
      searchKeys: searchKeys ?? [],
      columns: ADMIN_USER_SEARCH_COLUMNS,
      defaultKeys: ['username'],
      conditions,
      params,
    })
  }

  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''

  const db = await getDb()
  const countResult = await db.query<{ count: number | string }>(
    `select count(*) as count from users${whereClause}`,
    params,
  )
  const total = Number(countResult.rows[0]?.count ?? 0)

  let sql = `select id, username, email, status, created_at from users${whereClause} order by ${sortColumn} ${sortDir}`
  const listParams = [...params]
  if (limit !== undefined) {
    sql += ` limit $${listParams.length + 1}`
    listParams.push(limit)
    sql += ` offset $${listParams.length + 1}`
    listParams.push(offset)
  }

  const result = await db.query<UserAdminRow>(sql, listParams)
  return {
    users: result.rows.map(toAdminUser),
    total,
    hasMore: limit !== undefined ? offset + result.rows.length < total : false,
  }
}

export interface UpdateUserInput {
  username?: string
  email?: string
  password?: string
  status?: UserStatus
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<User | null> {
  const sets: string[] = []
  const params: unknown[] = []
  if (input.username !== undefined) {
    params.push(normalizeUsername(input.username))
    sets.push(`username = $${params.length}`)
  }
  if (input.email !== undefined) {
    params.push(normalizeEmail(input.email))
    sets.push(`email = $${params.length}`)
  }
  if (input.password !== undefined) {
    if (!input.password) {
      throw new Error('password is required')
    }
    params.push(await hashPassword(input.password))
    sets.push(`password_hash = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(normalizeStatus(input.status))
    sets.push(`status = $${params.length}`)
  }
  if (sets.length === 0) {
    return findUserById(id)
  }

  params.push(id)
  const db = await getDb()
  try {
    const result = await db.query<UserRow>(
      `update users set ${sets.join(', ')} where id = $${params.length} returning id, username, email, status`,
      params,
    )
    const row = result.rows[0]
    return row ? toUser(row) : null
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error('username or email is already taken')
    }
    throw error
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  const db = await getDb()
  const result = await db.query('delete from users where id = $1', [id])
  return (result.rowCount ?? 0) > 0
}
