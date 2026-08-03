import { randomBytes } from 'node:crypto'
import { getDb } from './db'

export const DEFAULT_DOCUMENT_NAME = 'Untitled'
export const MAX_NAME_LENGTH = 200
export const MAX_CONTENT_BYTES = 1024 * 1024
export const KEY_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'
export const KEY_LENGTH = 6

export class DocumentLimitError extends Error {}

export const MAX_DOCUMENTS_PER_USER = readMaxDocumentsPerUser()
export const MAX_CONTENT_LENGTH = readMaxContentLength()

function readMaxDocumentsPerUser() {
  const raw = process.env.MAX_DOCUMENTS_PER_IP?.trim()
  if (!raw) {
    return 10
  }
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : 10
}

function readMaxContentLength() {
  const raw = process.env.MAX_CONTENT_LENGTH?.trim()
  if (!raw) {
    return MAX_CONTENT_BYTES
  }
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : MAX_CONTENT_BYTES
}

export interface DocumentSummary {
  id: string
  name: string
  updatedAt: string
}

export interface Document extends DocumentSummary {
  content: string
}

interface DocumentRow {
  id: string | number
  key: string
  name: string
  content: string
  updated_at: Date | string
}

export function generateDocumentKey() {
  const chars: string[] = []
  const byteLength = Math.ceil((KEY_LENGTH * 256) / KEY_CHARS.length)
  const bytes = randomBytes(byteLength)
  let offset = 0
  for (let i = 0; i < KEY_LENGTH; i++) {
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

export function isDocumentKey(value: string) {
  return /^[0-9a-z]{6}$/.test(value)
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

export function nextDefaultDocumentName(existingNames: string[]) {
  const used = new Set(existingNames)
  if (!used.has(DEFAULT_DOCUMENT_NAME)) {
    return DEFAULT_DOCUMENT_NAME
  }
  let index = 1
  while (used.has(`${DEFAULT_DOCUMENT_NAME} ${index}`)) {
    index += 1
  }
  return `${DEFAULT_DOCUMENT_NAME} ${index}`
}

export function contentByteSize(content: string) {
  return Buffer.byteLength(content, 'utf8')
}

export function assertContentWithinLimit(content: string) {
  if (contentByteSize(content) > MAX_CONTENT_BYTES) {
    throw new Error('content exceeds the 1 MB limit')
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`content exceeds the ${MAX_CONTENT_LENGTH}-character limit`)
  }
}

export function toDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.key,
    name: row.name,
    updatedAt: toIsoString(row.updated_at),
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

export async function fetchDocumentSummaries(limit?: number, offset: number = 0) {
  let sql = 'select key, name, updated_at from documents order by updated_at desc'
  const params: unknown[] = []

  if (limit !== undefined) {
    sql += ' limit $1'
    params.push(limit)
    sql += ' offset $2'
    params.push(offset)
  }

  const result = await runQuery<DocumentRow>(sql, params)
  return result.rows.map(toDocumentSummary)
}

export async function countDocumentsByCreator(by: string) {
  const result = await runQuery<{ count: number | string }>(
    'select count(*) as count from documents where created_by = $1',
    [by],
  )
  return Number(result.rows[0]?.count ?? 0)
}

export async function assertWithinDocumentLimit(by: string) {
  if (await countDocumentsByCreator(by) >= MAX_DOCUMENTS_PER_USER) {
    throw new DocumentLimitError(
      `Each IP can create at most ${MAX_DOCUMENTS_PER_USER} documents`,
    )
  }
}

export async function fetchDocument(id: string) {
  const result = await runQuery<DocumentRow>('select key, name, content, updated_at from documents where key = $1', [
    id,
  ])
  const row = result.rows[0]
  return row ? toDocument(row) : null
}

export async function insertDocument(options: { name: string; content: string; by: string }) {
  await assertWithinDocumentLimit(options.by)
  const key = generateDocumentKey()
  const result = await runQuery<DocumentRow>(
    `insert into documents (key, name, content, created_by, updated_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, current_timestamp, current_timestamp)
     returning id, key, name, content, updated_at`,
    [key, options.name, options.content, options.by, options.by],
  )
  return toDocument(result.rows[0])
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
    `update documents set ${updates.join(', ')} where key = $${index} returning id, key, name, content, updated_at`,
    values,
  )
  const row = result.rows[0]
  return row ? toDocument(row) : null
}

export async function deleteDocument(id: string) {
  const result = await runQuery('delete from documents where key = $1', [id])
  return (result.rowCount ?? 0) > 0
}
