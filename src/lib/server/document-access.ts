import { getDb } from './db'
import { fetchDocument } from './document-store'
import { toBoolean, type Document } from './document-model'
import { runQuery } from './db-query'
import { findUsersByUsernameOrEmail, type User } from './users'
import type { Viewer } from './viewer'

interface DocumentAccessRow {
  key: string
  created_by: string
  owner_user_id: string | number | null
  is_public: boolean | number | string | null
}

async function fetchDocumentAccessRow(id: string) {
  const result = await runQuery<DocumentAccessRow>(
    'select key, created_by, owner_user_id, is_public from documents where key = $1',
    [id],
  )
  return result.rows[0] ?? null
}

export interface DocumentAccess {
  document: Document | null
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canManageAccess: boolean
}

export async function resolveDocumentAccess(id: string, viewer: Viewer): Promise<DocumentAccess> {
  const document = await fetchDocument(id)
  if (!document) {
    return { document: null, canView: false, canEdit: false, canDelete: false, canManageAccess: false }
  }
  const row = await fetchDocumentAccessRow(id)
  const ownerUserId = row?.owner_user_id == null ? null : Number(row.owner_user_id)
  const isPublic = toBoolean(row?.is_public ?? true)
  const createdBy = row?.created_by ?? ''

  if (viewer.type === 'admin') {
    return {
      document,
      canView: true,
      canEdit: true,
      canDelete: true,
      canManageAccess: true,
    }
  }

  if (viewer.type === 'anonymous') {
    const owned = ownerUserId === null && createdBy === viewer.ip
    return {
      document,
      canView: isPublic || owned,
      canEdit: owned,
      canDelete: owned,
      canManageAccess: false,
    }
  }

  const owned = ownerUserId === viewer.userId
  const shared = await isSharedWithUser(id, viewer.userId)
  return {
    document,
    canView: isPublic || owned || shared,
    canEdit: isPublic || owned || shared,
    canDelete: owned,
    canManageAccess: owned,
  }
}

async function isSharedWithUser(id: string, userId: number) {
  const result = await runQuery<{ count: number | string }>(
    `select count(*) as count from document_shares
     where document_id = (select id from documents where key = $1) and user_id = $2`,
    [id, userId],
  )
  return Number(result.rows[0]?.count ?? 0) > 0
}

export interface DocumentAccessState {
  isPublic: boolean
  sharedWith: User[]
}

export async function getDocumentAccess(id: string): Promise<DocumentAccessState | null> {
  const row = await fetchDocumentAccessRow(id)
  if (!row) {
    return null
  }
  const shares = await runQuery<UserRow & { id: string | number }>(
    `select u.id, u.username, u.email, u.status from document_shares s
     join users u on u.id = s.user_id
     where s.document_id = (select id from documents where key = $1)
     order by u.username asc`,
    [id],
  )
  return {
    isPublic: toBoolean(row.is_public),
    sharedWith: shares.rows.map(row => ({
      id: Number(row.id),
      username: row.username,
      email: row.email,
      status: row.status === 'inactive' ? 'inactive' : 'active',
    })),
  }
}

interface UserRow {
  id: string | number
  username: string
  email: string
  status: string | null
}

// Resolves sharee values (usernames or emails) and returns the subset that do
// not match any user, so access updates can reject unresolvable sharees
// up-front rather than silently dropping them. Shared by the document access
// route and the admin edit-document route.
export async function missingSharees(values: string[], includeInactive = false): Promise<string[]> {
  const users = await findUsersByUsernameOrEmail(values, includeInactive)
  const resolvedIdentifiers = new Set<string>()
  for (const user of users) {
    resolvedIdentifiers.add(user.username.toLowerCase())
    if (user.email) {
      resolvedIdentifiers.add(user.email.toLowerCase())
    }
  }
  return values.filter(value => !resolvedIdentifiers.has(value.trim().toLowerCase()))
}

export const MAX_SHAREES = 100

export async function setDocumentAccess(
  id: string,
  input: { isPublic?: boolean; sharedWith?: string[] },
  options: { includeInactive?: boolean } = {},
): Promise<DocumentAccessState | null> {
  const row = await fetchDocumentAccessRow(id)
  if (!row) {
    return null
  }
  const ownerUserId = row.owner_user_id == null ? null : Number(row.owner_user_id)

  let shareeIds: number[] | undefined
  if (input.sharedWith !== undefined) {
    const users = await findUsersByUsernameOrEmail(input.sharedWith, options.includeInactive)
    shareeIds = users.map(user => user.id).filter(userId => userId !== ownerUserId)
  }

  const db = await getDb()
  await db.transaction(async query => {
    if (input.isPublic !== undefined) {
      await query('update documents set is_public = $1 where key = $2', [input.isPublic, id])
    }
    if (shareeIds !== undefined) {
      await query('delete from document_shares where document_id = (select id from documents where key = $1)', [id])
      for (const userId of shareeIds) {
        await query(
          `insert into document_shares (document_id, user_id, created_at)
           values ((select id from documents where key = $1), $2, current_timestamp)`,
          [id, userId],
        )
      }
    }
  })

  return getDocumentAccess(id)
}
