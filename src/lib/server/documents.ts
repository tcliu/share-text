import { randomBytes } from 'node:crypto'
import { getDb } from './db'
import { logEvent } from './logging'
import { getDocumentKeyLength, getMaxDocumentsPerUser } from './settings'

export const MAX_NAME_LENGTH = 200
export const MAX_CONTENT_BYTES = 1024 * 1024
export const KEY_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'
export const KEY_LENGTH = 6
export const MAX_KEY_ATTEMPTS = 5
const documentKeyCharsRegex = /^[0-9a-z]+$/

export class DocumentLimitError extends Error {}

export interface DocumentSummary {
  id: string
  name: string
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
  updated_by: string
  updated_at: Date | string
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
  if (!(error instanceof Error)) {
    return false
  }
  const code = (error as Error & { code?: unknown }).code
  if (code === '23505') {
    return true
  }
  const errcode = (error as Error & { errcode?: unknown }).errcode
  if (errcode === 2067) {
    return true
  }
  return error.message.includes('UNIQUE constraint failed')
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

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function runQuery<T>(sql: string, params: unknown[] = []) {
  return getDb().then(db => db.query<T>(sql, params))
}

export interface FetchDocumentSummariesOptions {
  by?: string
  limit?: number
  offset?: number
}

export interface FetchDocumentSummariesResult {
  documents: DocumentSummary[]
  hasMore: boolean
}

export async function fetchDocumentSummaries(options: FetchDocumentSummariesOptions = {}) {
  const { by, limit, offset = 0 } = options
  const sql = 'select key, name, updated_by, updated_at from documents'
  const params: unknown[] = []
  const conditions: string[] = []

  if (by !== undefined) {
    conditions.push('created_by = $1')
    params.push(by)
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
  return {
    documents: rows.map(toDocumentSummary),
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
  if (await countDocumentsByCreator(by) >= maxDocuments) {
    throw new DocumentLimitError(
      `Each IP can create at most ${maxDocuments} documents`,
    )
  }
}

export async function fetchDocument(id: string) {
  const result = await runQuery<DocumentRow>('select key, name, content, updated_by, updated_at from documents where key = $1', [
    id,
  ])
  const row = result.rows[0]
  return row ? toDocument(row) : null
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

interface AdminDocumentRow {
  key: string
  name: string
  created_by: string
  updated_by: string
  created_at: Date | string
  updated_at: Date | string
  content_size: number | string
}

interface AdminDocumentDetailRow extends AdminDocumentRow {
  content: string
}

function toAdminDocumentSummary(row: AdminDocumentRow): AdminDocumentSummary {
  return {
    id: row.key,
    name: row.name,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    contentSize: Number(row.content_size ?? 0),
  }
}

const ADMIN_SORT_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  length: 'content_size',
  updatedBy: 'updated_by',
  updatedAt: 'updated_at',
}

const ADMIN_SEARCH_COLUMNS: Record<string, string> = {
  id: 'key',
  name: 'name',
  updatedBy: 'updated_by',
}

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
  let index = 1

  if (search) {
    const searchColumns = (searchKeys && searchKeys.length > 0 ? searchKeys : ['name'])
      .map(key => ADMIN_SEARCH_COLUMNS[key])
      .filter((column): column is string => Boolean(column))
    if (searchColumns.length > 0) {
      const likeClauses = searchColumns.map(column => `lower(${column}) like $${index}`)
      for (const _column of searchColumns) {
        params.push(`%${search.toLowerCase()}%`)
        index += 1
      }
      conditions.push(`(${likeClauses.join(' or ')})`)
    } else {
      conditions.push('1 = 0')
    }
  }
  if (by) {
    conditions.push(`created_by = $${index}`)
    params.push(by)
    index += 1
  }

  const whereClause = conditions.length > 0 ? ' where ' + conditions.join(' and ') : ''

  const countResult = await runQuery<{ count: number | string }>(
    `select count(*) as count from documents${whereClause}`,
    params,
  )
  const total = Number(countResult.rows[0]?.count ?? 0)

  let sql = `select key, name, created_by, updated_by, created_at, updated_at, length(content) as content_size
    from documents${whereClause} order by ${sortColumn} ${sortDir}`
  const listParams = [...params]
  if (limit !== undefined) {
    sql += ` limit $${index}`
    listParams.push(limit)
    index += 1
    sql += ` offset $${index}`
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
    `select key, name, content, created_by, updated_by, created_at, updated_at, length(content) as content_size
     from documents where key = $1`,
    [id],
  )
  const row = result.rows[0]
  return row ? { ...toAdminDocumentSummary(row), content: row.content } : null
}

export async function insertDocument(options: { name?: string; content: string; by: string }) {
  await assertWithinDocumentLimit(options.by)
  const keyLength = await getDocumentKeyLength()
  for (let attempt = 1; ; attempt++) {
    const key = generateDocumentKey(keyLength)
    const name = options.name ?? key
    try {
      const result = await runQuery<DocumentRow>(
        `insert into documents (key, name, content, created_by, updated_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, current_timestamp, current_timestamp)
         returning id, key, name, content, updated_by, updated_at`,
        [key, name, options.content, options.by, options.by],
      )
      return toDocument(result.rows[0])
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

export async function updateDocument(id: string, options: { name?: string; content?: string; by: string }) {
  const updates: string[] = []
  const values: unknown[] = []
  let index = 1

  if (options.name !== undefined) {
    updates.push(`name = $${index}`)
    values.push(options.name)
    index += 1
  }
  if (options.content !== undefined) {
    updates.push(`content = $${index}`)
    values.push(options.content)
    index += 1
  }

  if (updates.length === 0) {
    return null
  }

  updates.push('updated_by = $' + index)
  values.push(options.by)
  index += 1
  updates.push('updated_at = current_timestamp')
  values.push(id)

  const result = await runQuery<DocumentRow>(
    `update documents set ${updates.join(', ')} where key = $${index} returning id, key, name, content, updated_by, updated_at`,
    values,
  )
  const row = result.rows[0]
  return row ? toDocument(row) : null
}

export async function deleteDocument(id: string) {
  const result = await runQuery('delete from documents where key = $1', [id])
  return (result.rowCount ?? 0) > 0
}
