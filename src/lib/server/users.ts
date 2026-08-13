import { getDb } from './db'
import { isUniqueViolation } from './db-errors'
import { hashPassword, verifyPassword } from './password'

export const MAX_USERNAME_LENGTH = 32
export const MAX_EMAIL_LENGTH = 254
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface User {
  id: number
  username: string
  email: string
}

interface UserRow {
  id: string | number
  username: string
  email: string
}

interface UserWithHashRow extends UserRow {
  password_hash: string
}

function toUser(row: UserRow): User {
  return { id: Number(row.id), username: row.username, email: row.email }
}

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase()
  if (!username) {
    throw new Error('username is required')
  }
  if (username.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(username)) {
    throw new Error(
      `username must be 3-${MAX_USERNAME_LENGTH} lowercase letters, numbers, or underscores`,
    )
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

export async function createUser(input: { username: string; email: string; password: string }): Promise<User> {
  const username = normalizeUsername(input.username)
  const email = normalizeEmail(input.email)
  if (!input.password) {
    throw new Error('password is required')
  }
  const passwordHash = hashPassword(input.password)
  const db = await getDb()
  try {
    const result = await db.query<UserRow>(
      `insert into users (username, email, password_hash, created_at)
       values ($1, $2, $3, current_timestamp)
       returning id, username, email`,
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

export async function findUserById(id: number): Promise<User | null> {
  const db = await getDb()
  const result = await db.query<UserRow>('select id, username, email from users where id = $1', [id])
  const row = result.rows[0]
  return row ? toUser(row) : null
}

export async function findUserByCredentials(identifier: string, password: string): Promise<User | null> {
  const value = identifier.trim().toLowerCase()
  if (!value || !password) {
    return null
  }
  const db = await getDb()
  const result = await db.query<UserWithHashRow>(
    'select id, username, email, password_hash from users where username = $1 or email = $2',
    [value, value],
  )
  const row = result.rows[0]
  if (!row || !verifyPassword(password, row.password_hash)) {
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
    `select id, username, email from users where ${conditions.join(' or ')}`,
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
    `select id, username, email from users
     where lower(username) like $1 or lower(email) like $2
     order by username asc limit $3`,
    [`${value}%`, `${value}%`, limit],
  )
  return result.rows.map(toUser)
}
