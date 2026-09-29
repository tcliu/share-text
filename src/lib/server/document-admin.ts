import { getDb } from './db'
import { toIsoString } from './iso-string'
import { appendSearchConditions } from './sql-search'
import { getDocumentKeyLength, getMaxContentLength, getMaxDocumentVersions } from './settings'
import {
  MAX_KEY_ATTEMPTS,
  assertContentWithinLimit,
  generateDocumentKey,
  isValidDocumentType,
  normalizeDocumentKey,
  normalizeName,
  parseTags,
  serializeTags,
  toBoolean,
  toDocument,
  type Document,
  type DocumentRow,
  type DocumentType,
} from './document-model'
import { ADMIN_SEARCH_COLUMNS, ADMIN_SORT_COLUMNS, DOCUMENT_SEARCH_COLUMNS } from './document-query'
import { runQuery } from './db-query'
import { invalidateTagsCache, updateDocument } from './document-store'
import { insertDocumentVersion } from './document-versions'
import type { Tag } from '$lib/tag-colors'

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

export interface ListDocumentsOptions {
  search?: string
  searchKeys?: string[]
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface ListDocumentsForAdminOptions extends ListDocumentsOptions {
  by?: string
}

export type ListOwnedDocumentsOptions = ListDocumentsOptions

interface DocumentListScope {
  searchColumns: Record<string, string>
  createdBy?: string
  ownerUserId?: number
}

async function listDocuments(scope: DocumentListScope, options: ListDocumentsOptions) {
  const { search, searchKeys, limit, offset = 0, sortBy, order } = options
  const sortColumn = ADMIN_SORT_COLUMNS[sortBy ?? 'updatedAt'] ?? ADMIN_SORT_COLUMNS.updatedAt
  const sortDir = order === 'asc' ? 'asc' : 'desc'
  const conditions: string[] = []
  const params: unknown[] = []

  if (scope.ownerUserId !== undefined) {
    conditions.push(`owner_user_id = $${params.length + 1}`)
    params.push(scope.ownerUserId)
  }
  if (scope.createdBy !== undefined) {
    conditions.push(`created_by = $${params.length + 1}`)
    params.push(scope.createdBy)
  }
  if (search) {
    appendSearchConditions({
      search,
      searchKeys: searchKeys ?? [],
      columns: scope.searchColumns,
      defaultKeys: ['name'],
      conditions,
      params,
    })
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

export function listDocumentsForAdmin(options: ListDocumentsForAdminOptions = {}) {
  const { by, ...listOptions } = options
  return listDocuments({ searchColumns: ADMIN_SEARCH_COLUMNS, createdBy: by }, listOptions)
}

export function listDocumentsForOwnedUser(userId: number, options: ListOwnedDocumentsOptions = {}) {
  return listDocuments({ searchColumns: DOCUMENT_SEARCH_COLUMNS, ownerUserId: userId }, options)
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
  const created = await db.transaction(async query => {
    const imported: Document[] = []
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
            imported.push(updated)
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
      imported.push(document)
    }
    return imported
  })
  invalidateTagsCache()
  return created
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
