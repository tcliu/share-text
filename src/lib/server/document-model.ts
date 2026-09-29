import { randomBytes } from 'node:crypto'
import { isUniqueViolation } from './db-errors'
import { toIsoString } from './iso-string'
import { getDocumentKeyLength } from './settings'
import { DOCUMENT_TYPE_VALUES, isDocumentTypeValue, type DocumentTypeValue } from '$lib/document-type-values'
import { getDefaultTagColor, isTagColor, pickTagColor, sameColorFamily, type Tag } from '$lib/tag-colors'

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

export interface DocumentRow {
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

export function toBoolean(value: boolean | number | string | null | undefined) {
  return value === true || value === 1 || value === '1' || value === 't'
}

export function parseTags(value: string | null | undefined): Tag[] {
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

export function serializeTags(tags: Tag[] | undefined): string {
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
