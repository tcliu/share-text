import { getDb } from './db'
import type { DbQuery } from './db-types'
import { runQuery } from './db-query'
import { logEvent } from './logging'
import { appendSearchConditions } from './sql-search'
import { getDocumentKeyLength, getMaxContentLength, getMaxDocumentVersions, getMaxDocumentsPerUser } from './settings'
import {
  DocumentLimitError,
  MAX_KEY_ATTEMPTS,
  assertContentWithinLimit,
  generateDocumentKey,
  isUniqueKeyViolation,
  parseTags,
  serializeTags,
  toBoolean,
  toDocument,
  toDocumentSummary,
  type Document,
  type DocumentRow,
  type DocumentSummary,
  type DocumentType,
} from './document-model'
import { DOCUMENT_SEARCH_COLUMNS } from './document-query'
import { insertDocumentVersion } from './document-versions'
import type { Viewer } from './viewer'
import type { User } from './users'
import type { Tag } from '$lib/tag-colors'

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
  if (document && options.tags !== undefined) {
    invalidateTagsCache()
  }
  return document
}

export async function deleteDocument(id: string) {
  // The SQLite adapter does not enforce foreign keys and each `runQuery` uses
  // its own connection, so the app-side child deletes must run atomically with
  // the parent delete on one connection. On Postgres the `on delete cascade`
  // FK also covers them; deleting first is idempotent there.
  const db = await getDb()
  const deleted = await db.transaction(async query => {
    await query('delete from document_shares where document_id = (select id from documents where key = $1)', [id])
    await query('delete from document_versions where document_id = (select id from documents where key = $1)', [id])
    const result = await query('delete from documents where key = $1', [id])
    return (result.rowCount ?? 0) > 0
  })
  if (deleted) {
    invalidateTagsCache()
  }
  return deleted
}

/**
 * Return the distinct set of tags across all documents.
 * This works with both SQLite (tags stored as JSON text) and Postgres.
 *
 * Cached in memory for 5 seconds to avoid full-table scans on every
 * request. Invalidated by the mutations that can change the tag set:
 * a tag-changing update, a delete, and an admin import.
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
  const now = Date.now()
  const cached = tagsCache.get(cacheKey)
  if (cached && now - cached.ts < 5000) {
    return cached.tags
  }
  // Drop expired entries so per-viewer cache keys (one per anonymous IP) do
  // not accumulate between mutations.
  for (const [key, entry] of tagsCache) {
    if (now - entry.ts >= 5000) {
      tagsCache.delete(key)
    }
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
