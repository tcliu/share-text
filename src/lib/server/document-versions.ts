import type { DbQuery } from './db-types'
import { runQuery } from './db-query'
import { toIsoString } from './iso-string'
import { getMaxDocumentVersions } from './settings'
import { isValidDocumentType, type Document, type DocumentType } from './document-model'

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

export async function insertDocumentVersion(
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
