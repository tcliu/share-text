import { randomBytes } from 'node:crypto'
import { getDb } from './db'
import { isUniqueViolation } from './db-errors'
import type { DbQuery } from './db-types'
import { toIsoString } from './iso-string'
import { logEvent } from './logging'
import { appendSearchConditions } from './sql-search'
import { getDocumentKeyLength, getMaxContentLength, getMaxDocumentVersions, getMaxDocumentsPerUser } from './settings'
import { DOCUMENT_TYPE_VALUES, isDocumentTypeValue, type DocumentTypeValue } from '$lib/document-type-values'
import { getDefaultTagColor, isTagColor, pickTagColor, sameColorFamily, type Tag } from '$lib/tag-colors'
import type { Viewer } from './viewer'
import { findUsersByUsernameOrEmail, type User } from './users'

export const MAX_NAME_LENGTH = 200
export const MAX_CONTENT_BYTES = 1024 * 1024
export const KEY_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'
export const KEY_LENGTH = 6
export const MAX_KEY_ATTEMPTS = 5
const documentKeyCharsRegex = /^[0-9a-z]+$/

export const DOCUMENT_TYPES = DOCUMENT_TYPE_VALUES

export type DocumentType = DocumentTypeValue

export function isValidDocumentType(value: unknown): value is DocumentType {
  return isDocumentTypeValue(value)
}

export class DocumentLimitError extends Error {}

export interface DocumentSummary {
  id: string
  name: string
  documentType: DocumentType
  tags: Tag[]
  updatedAt: string
  updatedBy: string
}

export interface Document extends DocumentSummary {
  content: string
}

interface DocumentRow {
  id: string | number
  key: string
  name: string
  content: string
  document_type: string
  tags: string | null
  created_by?: string
  updated_by: string
  updated_at: Date | string
  owner_user_id?: string | number | null
  is_public?: boolean | number | string | null
}

function toBoolean(value: boolean | number | string | null | undefined) {
  return value === true || value === 1 || value === '1' || value === 't'
}

function parseTags(value: string | null | undefined): Tag[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    const tags: Tag[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (typeof item === 'string') {
        const name = item.trim()
        const key = name.toLowerCase()
        if (!name || seen.has(key)) {
          continue
        }
        seen.add(key)
        tags.push({ name, color: getDefaultTagColor(name) })
      } else if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
        const name = (item as { name: string }).name.trim()
        const key = name.toLowerCase()
        if (!name || seen.has(key)) {
          continue
        }
        seen.add(key)
        const rawColor = (item as { color?: unknown }).color
        const color = typeof rawColor === 'string' && isTagColor(rawColor) ? rawColor : getDefaultTagColor(name)
        tags.push({ name, color })
      }
    }
    return tags
  } catch {
    return []
  }
}

function serializeTags(tags: Tag[] | undefined): string {
  if (!tags) {
    return '[]'
  }

  const seen = new Set<string>()
  const normalized: Tag[] = []
  for (const rawTag of tags) {
    const name = rawTag.name.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) {
      continue
    }
    seen.add(key)
    const color = isTagColor(rawTag.color) ? rawTag.color : getDefaultTagColor(name)
    normalized.push({ name, color })
  }

  normalized.sort((a, b) => a.name.localeCompare(b.name))

  const result: Tag[] = []
  for (const tag of normalized) {
    const prev = result[result.length - 1]
    const color = prev && sameColorFamily(tag.color, prev.color) ? pickTagColor(tag.name, [prev.color]) : tag.color
    result.push({ name: tag.name, color })
  }
  return JSON.stringify(result)
}

export function generateDocumentKey(length = KEY_LENGTH) {
  const chars: string[] = []
  const byteLength = Math.ceil((length * 256) / KEY_CHARS.length)
  const bytes = randomBytes(byteLength)
  let offset = 0
  for (let i = 0; i < length; i++) {
    let random = bytes[offset++]
    // Rejection sampling keeps each position uniform despite char count not
    // dividing 256.
    while (random >= KEY_CHARS.length * Math.floor(256 / KEY_CHARS.length)) {
      random = bytes[offset++ % bytes.length]
    }
    chars.push(KEY_CHARS[random % KEY_CHARS.length])
  }
  return chars.join('')
}

const documentKeyRegexCache = new Map<number, RegExp>()

export function isDocumentKey(value: string, length = KEY_LENGTH) {
  let regex = documentKeyRegexCache.get(length)
  if (!regex) {
    regex = new RegExp(`^[0-9a-z]{${length}}$`)
    documentKeyRegexCache.set(length, regex)
  }
  return regex.test(value)
}

export function isDocumentKeyChars(value: string) {
  return documentKeyCharsRegex.test(value)
}

export function isUniqueKeyViolation(error: unknown) {
  return isUniqueViolation(error)
}

export function normalizeName(value: string) {
  const name = value.trim()
  if (!name) {
    throw new Error('name is required')
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`name exceeds the ${MAX_NAME_LENGTH}-character limit`)
  }
  return name
}

export const MAX_ATTRIBUTION_LENGTH = 100

function normalizeAttribution(value: string, field: string) {
  const result = value.trim()
  if (!result) {
    throw new Error(`${field} is required`)
  }
  if (result.length > MAX_ATTRIBUTION_LENGTH) {
    throw new Error(`${field} exceeds the ${MAX_ATTRIBUTION_LENGTH}-character limit`)
  }
  return result
}

export function normalizeUpdatedBy(value: string) {
  return normalizeAttribution(value, 'updated by')
}

export function normalizeCreatedBy(value: string) {
  return normalizeAttribution(value, 'created by')
}

export async function normalizeDocumentKey(value: string) {
  const key = value.trim().toLowerCase()
  const length = await getDocumentKeyLength()
  if (!isDocumentKey(key, length)) {
    throw new Error(`document key must be ${length} lowercase alphanumeric characters`)
  }
  return key
}

export function contentByteSize(content: string) {
  return Buffer.byteLength(content, 'utf8')
}

export function assertContentWithinLimit(content: string, maxContentLength: number) {
  if (contentByteSize(content) > MAX_CONTENT_BYTES) {
    throw new Error('content exceeds the 1 MB limit')
  }
  if (content.length > maxContentLength) {
    throw new Error(`content exceeds the ${maxContentLength}-character limit`)
  }
}

export function toDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.key,
    name: row.name,
    documentType: (isValidDocumentType(row.document_type) ? row.document_type : 'text') as DocumentType,
    tags: parseTags(row.tags),
    updatedAt: toIsoString(row.updated_at),
    updatedBy: row.updated_by,
  }
}

export function toDocument(row: DocumentRow): Document {
  return {
    ...toDocumentSummary(row),
    content: row.content,
  }
}

function runQuery<T>(sql: string, params: unknown[] = []) {
  return getDb().then(db => db.query<T>(sql, params))
}

export interface FetchDocumentSummariesOptions {
  search?: string
  searchKeys?: string[]
  viewer?: Viewer
  limit?: number
  offset?: number
}

export interface FetchDocumentSummariesResult {
  documents: Array<DocumentSummary & { owned: boolean; editable: boolean; isPublic: boolean }>
  hasMore: boolean
}

function appendVisibilityCondition(viewer: Viewer | undefined, conditions: string[], params: unknown[]) {
  if (viewer?.type === 'admin') {
    return
  }
  if (viewer?.type === 'user') {
    const ownerIndex = params.length + 1
    params.push(viewer.userId)
    const shareIndex = params.length + 1
    params.push(viewer.userId)
    conditions.push(
      `(is_public = true or owner_user_id = $${ownerIndex} or exists (select 1 from document_shares s where s.document_id = documents.id and s.user_id = $${shareIndex}))`,
    )
  } else {
    conditions.push('is_public = true')
  }
}

export async function fetchDocumentSummaries(options: FetchDocumentSummariesOptions = {}) {
  const { search, searchKeys, viewer, limit, offset = 0 } = options
  const sql =
    'select key, name, document_type, tags, created_by, updated_by, updated_at, owner_user_id, is_public from documents'
  const params: unknown[] = []
  const conditions: string[] = []

  appendVisibilityCondition(viewer, conditions, params)

  if (search) {
    appendSearchConditions({
      search,
      searchKeys: searchKeys ?? [],
      columns: DOCUMENT_SEARCH_COLUMNS,
      defaultKeys: ['name'],
      conditions,
      params,
    })
  }

  let query = sql
  if (conditions.length > 0) {
    query += ' where ' + conditions.join(' and ')
  }

  query += ' order by updated_at desc'

  if (limit !== undefined) {
    const base = params.length
    query += ` limit $${base + 1}`
    params.push(limit + 1)
    query += ` offset $${base + 2}`
    params.push(offset)
  }

  const result = await runQuery<DocumentRow>(query, params)
  const rows = limit !== undefined ? result.rows.slice(0, limit) : result.rows
  const viewerUserId = viewer?.type === 'user' ? viewer.userId : null
  const isAdminViewer = viewer?.type === 'admin'
  return {
    documents: rows.map(row => {
      const ownerUserId = row.owner_user_id == null ? null : Number(row.owner_user_id)
      const owned = isAdminViewer
        ? true
        : viewerUserId !== null
          ? ownerUserId === viewerUserId
          : ownerUserId === null && (row.created_by ?? '') === (viewer?.ip ?? '')
      // Every document a registered user can see is public, owned, or shared
      // (enforced by appendVisibilityCondition), so it is always editable.
      const editable = isAdminViewer || viewerUserId !== null ? true : owned
      return {
        ...toDocumentSummary(row),
        owned,
        editable,
        isPublic: toBoolean(row.is_public),
      }
    }),
    hasMore: limit !== undefined ? result.rows.length > limit : false,
  }
}

export async function countDocumentsByCreator(by: string) {
  const result = await runQuery<{ count: number | string }>(
    'select count(*) as count from documents where created_by = $1',
    [by],
  )
  return Number(result.rows[0]?.count ?? 0)
}

export async function assertWithinDocumentLimit(by: string) {
  const maxDocuments = await getMaxDocumentsPerUser()
  if ((await countDocumentsByCreator(by)) >= maxDocuments) {
    throw new DocumentLimitError(`Each IP can create at most ${maxDocuments} documents`)
  }
}

export async function fetchDocument(id: string) {
  const result = await runQuery<DocumentRow>(
    'select key, name, content, document_type, tags, updated_by, updated_at from documents where key = $1',
    [id],
  )
  const row = result.rows[0]
  return row ? toDocument(row) : null
}

export async function claimAnonymousDocuments(ip: string, user: User) {
  await runQuery(
    'update documents set owner_user_id = $1, created_by = $2, updated_by = $3 where owner_user_id is null and created_by = $4',
    [user.id, user.username, user.username, ip],
  )
}

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

export interface AdminDocumentSummary {
  id: string
  name: string
  documentType: DocumentType
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

interface AdminDocumentRow {
  key: string
  name: string
  document_type: string
  tags: string | null
  created_by: string
  updated_by: string
  created_at: Date | string
  updated_at: Date | string
  content_size: number | string
  is_public?: boolean | number | string | null
}

interface AdminDocumentDetailRow extends AdminDocumentRow {
  content: string
  document_type: string
}

function toAdminDocumentSummary(row: AdminDocumentRow): AdminDocumentSummary {
  return {
    id: row.key,
    name: row.name,
    documentType: (isValidDocumentType(row.document_type) ? row.document_type : 'text') as DocumentType,
    tags: parseTags(row.tags),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    contentSize: Number(row.content_size ?? 0),
    isPublic: toBoolean(row.is_public),
  }
}

const ADMIN_SORT_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  documentType: 'document_type',
  length: 'content_size',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  updatedAt: 'updated_at',
}

const DOCUMENT_SEARCH_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  documentType: 'document_type',
  tags: 'tags',
  updatedBy: 'updated_by',
}

const ADMIN_SEARCH_COLUMNS: Record<string, string> = {
  ...DOCUMENT_SEARCH_COLUMNS,
  createdBy: 'created_by',
}

export const DOCUMENT_SEARCH_KEYS = Object.keys(DOCUMENT_SEARCH_COLUMNS)

export interface ListDocumentsForAdminOptions {
  search?: string
  searchKeys?: string[]
  by?: string
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export async function listDocumentsForAdmin(options: ListDocumentsForAdminOptions = {}) {
  const { search, searchKeys, by, limit, offset = 0, sortBy, order } = options
  const sortColumn = ADMIN_SORT_COLUMNS[sortBy ?? 'updatedAt'] ?? ADMIN_SORT_COLUMNS.updatedAt
  const sortDir = order === 'asc' ? 'asc' : 'desc'
  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    appendSearchConditions({
      search,
      searchKeys: searchKeys ?? [],
      columns: ADMIN_SEARCH_COLUMNS,
      defaultKeys: ['name'],
      conditions,
      params,
    })
  }
  if (by) {
    conditions.push(`created_by = $${params.length + 1}`)
    params.push(by)
  }

  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''

  const countResult = await runQuery<{ count: number | string }>(
    `select count(*) as count from documents${whereClause}`,
    params,
  )
  const total = Number(countResult.rows[0]?.count ?? 0)

  let sql = `select key, name, document_type, tags, created_by, updated_by, created_at, updated_at, length(content) as content_size, is_public
    from documents${whereClause} order by ${sortColumn} ${sortDir}`
  const listParams = [...params]
  if (limit !== undefined) {
    sql += ` limit $${listParams.length + 1}`
    listParams.push(limit)
    sql += ` offset $${listParams.length + 1}`
    listParams.push(offset)
  }

  const result = await runQuery<AdminDocumentRow>(sql, listParams)
  return {
    documents: result.rows.map(toAdminDocumentSummary),
    total,
    hasMore: limit !== undefined ? offset + result.rows.length < total : false,
  }
}

export async function fetchDocumentForAdmin(id: string) {
  const result = await runQuery<AdminDocumentDetailRow>(
    `select key, name, content, document_type, tags, created_by, updated_by, created_at, updated_at, length(content) as content_size, is_public
     from documents where key = $1`,
    [id],
  )
  const row = result.rows[0]
  return row
    ? {
        ...toAdminDocumentSummary(row),
        content: row.content,
        documentType: (isValidDocumentType(row.document_type) ? row.document_type : 'text') as DocumentType,
      }
    : null
}

export async function insertDocument(options: {
  name?: string
  content: string
  documentType?: DocumentType
  by: string
  ownerUserId?: number | null
}) {
  await assertWithinDocumentLimit(options.by)
  const keyLength = await getDocumentKeyLength()
  for (let attempt = 1; ; attempt++) {
    const key = generateDocumentKey(keyLength)
    const name = options.name ?? key
    try {
      const result = await runQuery<DocumentRow>(
        `insert into documents (key, name, content, document_type, tags, created_by, updated_by, owner_user_id, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp, current_timestamp)
         returning id, key, name, content, document_type, tags, updated_by, updated_at`,
        [
          key,
          name,
          options.content,
          options.documentType ?? 'text',
          '[]',
          options.by,
          options.by,
          options.ownerUserId ?? null,
        ],
      )
      const row = result.rows[0]
      const document = toDocument(row)
      const versionStartedAt = Date.now()
      try {
        await insertDocumentVersion(document, row.id, options.by)
      } catch (error) {
        logEvent({
          ip: options.by,
          action: 'document_version_create_error',
          details: {
            id: document.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            elapsed_ms: Date.now() - versionStartedAt,
          },
        })
      }
      return document
    } catch (error) {
      if (!isUniqueKeyViolation(error) || attempt >= MAX_KEY_ATTEMPTS) {
        throw error
      }
      logEvent({
        ip: options.by,
        action: 'document_key_collision',
        details: { key, attempt, level: 'WARN' },
      })
    }
  }
}

export const MAX_IMPORT_RECORDS = 500

export interface ImportDocumentRecord {
  name: string
  content?: string
  documentType?: string
  tags?: Tag[]
  isPublic?: boolean
  key?: string
}

export function normalizeImportTags(raw: unknown): Tag[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }
  return parseTags(JSON.stringify(raw))
}

async function prepareImportDocument(record: ImportDocumentRecord, index: number, maxContentLength: number) {
  let name: string
  try {
    name = normalizeName(record.name)
  } catch (error) {
    throw new Error(`record ${index}: ${error instanceof Error ? error.message : 'invalid name'}`)
  }
  if (typeof record.content !== 'string') {
    throw new Error(`record ${index}: content is required`)
  }
  try {
    assertContentWithinLimit(record.content, maxContentLength)
  } catch (error) {
    throw new Error(`record ${index}: ${error instanceof Error ? error.message : 'invalid content'}`)
  }
  const documentType = record.documentType ?? 'text'
  if (!isValidDocumentType(documentType)) {
    throw new Error(`record ${index}: invalid document type`)
  }
  let key: string | undefined
  if (record.key !== undefined) {
    try {
      key = await normalizeDocumentKey(record.key)
    } catch (error) {
      throw new Error(`record ${index}: ${error instanceof Error ? error.message : 'invalid document key'}`)
    }
  }
  return {
    name,
    content: record.content,
    documentType,
    tags: record.tags ?? [],
    isPublic: record.isPublic ?? true,
    key,
  }
}

/**
 * Bulk-create documents for the admin import dialog. All records are
 * validated up front and then inserted in a single transaction, so an invalid
 * record aborts the whole import (all-or-nothing). A record may carry an
 * optional `key`; keys are otherwise auto-generated. A record whose `key`
 * already exists merges (upserts) into that document — name, content, type,
 * tags, and visibility are updated and a version snapshot recorded — while
 * unknown keys insert. Key uniqueness (within the batch and against the
 * database) is pre-checked inside the transaction so collisions do not rely
 * on a unique-violation retry that would abort a Postgres transaction.
 */
export async function importDocumentsForAdmin(records: ImportDocumentRecord[], by: string): Promise<Document[]> {
  if (records.length === 0) {
    throw new Error('No records to import')
  }
  const keyLength = await getDocumentKeyLength()
  const maxContentLength = await getMaxContentLength()
  const maxDocumentVersions = await getMaxDocumentVersions()
  const prepared = await Promise.all(
    records.map((record, index) => prepareImportDocument(record, index + 1, maxContentLength)),
  )

  const seenKeys = new Set<string>()
  for (let i = 0; i < prepared.length; i++) {
    const key = prepared[i].key
    if (key === undefined) {
      continue
    }
    if (seenKeys.has(key)) {
      throw new Error(`record ${i + 1}: duplicate document key`)
    }
    seenKeys.add(key)
  }

  const db = await getDb()
  return db.transaction(async query => {
    const created: Document[] = []
    for (let i = 0; i < prepared.length; i++) {
      const record = prepared[i]
      if (record.key !== undefined) {
        const existing = await query<{ key: string }>('select key from documents where key = $1', [record.key])
        if (existing.rows.length > 0) {
          const updated = await updateDocument(
            record.key,
            {
              name: record.name,
              content: record.content,
              documentType: record.documentType,
              tags: record.tags,
              isPublic: record.isPublic,
              by,
            },
            query,
            { maxContentLength, maxDocumentVersions },
          )
          if (updated) {
            created.push(updated)
          }
          continue
        }
      }
      let key: string
      if (record.key !== undefined) {
        key = record.key
      } else {
        key = generateDocumentKey(keyLength)
        let available = false
        for (let attempt = 1; attempt <= MAX_KEY_ATTEMPTS; attempt++) {
          const existing = await query<{ key: string }>('select key from documents where key = $1', [key])
          if (existing.rows.length === 0) {
            available = true
            break
          }
          key = generateDocumentKey(keyLength)
        }
        if (!available) {
          throw new Error('Failed to generate a unique document key')
        }
      }
      const result = await query<DocumentRow>(
        `insert into documents (key, name, content, document_type, tags, created_by, updated_by, owner_user_id, is_public, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, null, $8, current_timestamp, current_timestamp)
         returning id, key, name, content, document_type, tags, updated_by, updated_at`,
        [key, record.name, record.content, record.documentType, serializeTags(record.tags), by, by, record.isPublic],
      )
      const row = result.rows[0]
      const document = toDocument(row)
      await insertDocumentVersion(document, row.id, by, query, maxDocumentVersions)
      created.push(document)
    }
    return created
  })
}

interface AdminDocumentExportRow {
  key: string
  name: string
  content: string
  document_type: string
  tags: string | null
  is_public: boolean | number | string | null
}

export interface AdminDocumentExportRecord {
  key: string
  name: string
  content: string
  documentType: DocumentType
  tags: Tag[]
  isPublic: boolean
}

/**
 * Export documents for the admin export action, shaped to match the admin
 * import record format so an export round-trips through import (the `key` is
 * preserved). When `ids` is provided only those keys are exported; otherwise
 * every document is exported.
 */
export async function exportDocumentsForAdmin(ids?: string[]): Promise<AdminDocumentExportRecord[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  if (ids && ids.length > 0) {
    const placeholders = ids.map((_, index) => `$${params.length + index + 1}`)
    conditions.push(`key in (${placeholders.join(', ')})`)
    params.push(...ids)
  }
  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''
  const db = await getDb()
  const result = await db.query<AdminDocumentExportRow>(
    `select key, name, content, document_type, tags, is_public
     from documents${whereClause}
     order by updated_at desc`,
    params,
  )
  return result.rows.map(row => ({
    key: row.key,
    name: row.name,
    content: row.content,
    documentType: (isValidDocumentType(row.document_type) ? row.document_type : 'text') as DocumentType,
    tags: parseTags(row.tags),
    isPublic: toBoolean(row.is_public),
  }))
}

export async function updateDocument(
  id: string,
  options: {
    name?: string
    content?: string
    documentType?: DocumentType
    tags?: Tag[]
    by: string
    // Optional document key override (used by admin edits to change the ID).
    key?: string
    // Optional overrides for the attribution fields (used by admin edits);
    // updated_by defaults to the requester `by` value.
    createdBy?: string
    updatedBy?: string
    // Optional access-control override (used by admin edits).
    isPublic?: boolean
  },
  query: DbQuery = runQuery,
  limits: { maxContentLength?: number; maxDocumentVersions?: number } = {},
) {
  const updates: string[] = []
  const values: unknown[] = []
  let index = 1

  if (options.name !== undefined) {
    updates.push(`name = $${index}`)
    values.push(options.name)
    index += 1
  }
  if (options.content !== undefined) {
    const maxContentLength = limits.maxContentLength ?? (await getMaxContentLength())
    assertContentWithinLimit(options.content, maxContentLength)
    updates.push(`content = $${index}`)
    values.push(options.content)
    index += 1
  }
  if (options.documentType !== undefined) {
    updates.push(`document_type = $${index}`)
    values.push(options.documentType)
    index += 1
  }
  if (options.tags !== undefined) {
    updates.push(`tags = $${index}`)
    values.push(serializeTags(options.tags))
    index += 1
  }
  if (options.key !== undefined) {
    updates.push(`key = $${index}`)
    values.push(options.key)
    index += 1
  }
  if (options.createdBy !== undefined) {
    updates.push(`created_by = $${index}`)
    values.push(options.createdBy)
    index += 1
  }
  if (options.updatedBy !== undefined) {
    updates.push(`updated_by = $${index}`)
    values.push(options.updatedBy)
    index += 1
  }
  if (options.isPublic !== undefined) {
    updates.push(`is_public = $${index}`)
    values.push(options.isPublic)
    index += 1
  }

  if (updates.length === 0) {
    return null
  }

  // A version snapshot is recorded when the document body (content or type)
  // changes, so fetch the pre-update values to detect that.
  let previous: { content: string; document_type: string } | null = null
  if (options.content !== undefined || options.documentType !== undefined) {
    const before = await query<{ content: string; document_type: string }>(
      'select content, document_type from documents where key = $1',
      [id],
    )
    previous = before.rows[0] ?? null
    if (!previous) {
      return null
    }
  }

  if (options.updatedBy === undefined) {
    updates.push('updated_by = $' + index)
    values.push(options.by)
    index += 1
  }
  updates.push('updated_at = current_timestamp')
  values.push(id)

  const result = await query<DocumentRow>(
    `update documents set ${updates.join(', ')} where key = $${index} returning id, key, name, content, document_type, tags, updated_by, updated_at`,
    values,
  )
  const row = result.rows[0]
  const document = row ? toDocument(row) : null
  if (document) {
    const contentChanged = options.content !== undefined && previous !== null && options.content !== previous.content
    const typeChanged =
      options.documentType !== undefined && previous !== null && options.documentType !== previous.document_type
    if (contentChanged || typeChanged) {
      const versionStartedAt = Date.now()
      try {
        await insertDocumentVersion(document, row.id, options.by, query, limits.maxDocumentVersions)
      } catch (error) {
        logEvent({
          ip: options.by,
          action: 'document_version_create_error',
          details: {
            id: document.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            elapsed_ms: Date.now() - versionStartedAt,
          },
        })
      }
    }
  }
  return document
}

export async function deleteDocument(id: string) {
  await runQuery('delete from document_shares where document_id = (select id from documents where key = $1)', [id])
  await runQuery('delete from document_versions where document_id = (select id from documents where key = $1)', [id])
  const result = await runQuery('delete from documents where key = $1', [id])
  return (result.rowCount ?? 0) > 0
}

/**
 * Return the distinct set of tags across all documents.
 * This works with both SQLite (tags stored as JSON text) and Postgres.
 *
 * Cached in memory for 5 seconds to avoid full-table scans on every
 * request. Invalidated on document create, update (when tags change),
 * and delete.
 */
let tagsCache = new Map<string, { tags: Tag[]; ts: number }>()

function tagsCacheKey(viewer?: Viewer) {
  if (viewer?.type === 'admin') {
    return 'admin'
  }
  if (viewer?.type === 'user') {
    return `user:${viewer.userId}`
  }
  return `anonymous:${viewer?.ip ?? ''}`
}

export function invalidateTagsCache() {
  tagsCache.clear()
}

export async function listDistinctTags(viewer?: Viewer) {
  const cacheKey = tagsCacheKey(viewer)
  const cached = tagsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < 5000) {
    return cached.tags
  }

  const conditions: string[] = []
  const params: unknown[] = []
  appendVisibilityCondition(viewer, conditions, params)
  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''

  const result = await runQuery<{ tags: string | null }>(`select tags from documents${whereClause}`, params)
  const seen = new Map<string, Tag>()
  for (const row of result.rows) {
    const parsed = parseTags(row.tags)
    for (const tag of parsed) {
      const key = tag.name.trim().toLowerCase()
      if (!key) continue
      if (!seen.has(key)) {
        seen.set(key, { name: tag.name, color: tag.color })
      }
    }
  }
  const tags = Array.from(seen.values())
  tags.sort((a, b) => a.name.localeCompare(b.name))
  tagsCache.set(cacheKey, { tags, ts: Date.now() })
  return tags
}

export interface DocumentVersionSummary {
  id: string
  documentId: string
  documentType: DocumentType
  updatedBy: string
  createdAt: string
  contentSize: number
}

export interface DocumentVersion extends DocumentVersionSummary {
  content: string
}

interface DocumentVersionRow {
  id: string | number
  content?: string
  document_type: string
  created_by: string
  created_at: Date | string
  content_size?: number | string
}

function toDocumentVersionSummary(row: DocumentVersionRow): DocumentVersionSummary {
  return {
    id: String(row.id),
    documentId: '',
    documentType: (isValidDocumentType(row.document_type) ? row.document_type : 'text') as DocumentType,
    updatedBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    contentSize: Number(row.content_size ?? (row.content ?? '').length),
  }
}

async function insertDocumentVersion(
  document: Document,
  dbId: string | number,
  by: string,
  query: DbQuery = runQuery,
  maxDocumentVersionsOverride?: number,
) {
  const maxVersions = maxDocumentVersionsOverride ?? (await getMaxDocumentVersions())
  await query(
    `insert into document_versions (document_id, content, document_type, created_by, created_at)
     values ($1, $2, $3, $4, current_timestamp)`,
    [dbId, document.content, document.documentType, by],
  )
  // Keep only the newest maxVersions snapshots for this document.
  await query(
    `delete from document_versions where document_id = $1 and id not in (
      select id from document_versions where document_id = $2
      order by created_at desc, id desc limit $3
    )`,
    [dbId, dbId, maxVersions],
  )
}

export async function fetchDocumentVersions(documentId: string): Promise<DocumentVersionSummary[]> {
  const result = await runQuery<DocumentVersionRow>(
    `select id, document_type, created_by, created_at, length(content) as content_size
     from document_versions
     where document_id = (select id from documents where key = $1)
     order by created_at desc, id desc`,
    [documentId],
  )
  return result.rows.map(row => ({ ...toDocumentVersionSummary(row), documentId }))
}

export async function fetchDocumentVersion(documentId: string, versionId: number): Promise<DocumentVersion | null> {
  const result = await runQuery<DocumentVersionRow>(
    `select id, content, document_type, created_by, created_at, length(content) as content_size
     from document_versions
     where document_id = (select id from documents where key = $1) and id = $2`,
    [documentId, versionId],
  )
  const row = result.rows[0]
  if (!row) {
    return null
  }
  return {
    ...toDocumentVersionSummary(row),
    documentId,
    content: row.content ?? '',
  }
}
