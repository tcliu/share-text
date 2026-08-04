import { describe, expect, it } from 'vitest'
import {
  KEY_LENGTH,
  MAX_CONTENT_BYTES,
  MAX_NAME_LENGTH,
  assertContentWithinLimit,
  contentByteSize,
  generateDocumentKey,
  isDocumentKeyChars,
  isDocumentKey,
  isUniqueKeyViolation,
  normalizeName,
  toDocument,
  toDocumentSummary,
} from '$lib/server/documents'

describe('isDocumentKey', () => {
  it('accepts six lowercase alphanumeric characters by default', () => {
    expect(isDocumentKey('a1b2c3')).toBe(true)
    expect(isDocumentKey('000000')).toBe(true)
    expect(isDocumentKey('zzz999')).toBe(true)
  })

  it('accepts keys of a custom length', () => {
    expect(isDocumentKey('a1b2c3d4', 8)).toBe(true)
    expect(isDocumentKey('z0z0z0z0z0', 10)).toBe(true)
  })

  it('rejects malformed values', () => {
    expect(isDocumentKey('')).toBe(false)
    expect(isDocumentKey('abcde')).toBe(false)
    expect(isDocumentKey('abcdefg')).toBe(false)
    expect(isDocumentKey('ABC123')).toBe(false)
    expect(isDocumentKey('abc-def')).toBe(false)
    expect(isDocumentKey('a1b2c3', 8)).toBe(false)
    expect(isDocumentKey('a1b2c3d4', 6)).toBe(false)
  })
})

describe('isDocumentKeyChars', () => {
  it('accepts lowercase alphanumeric ids of varying lengths', () => {
    expect(isDocumentKeyChars('a1b2c3')).toBe(true)
    expect(isDocumentKeyChars('abcd1234')).toBe(true)
  })

  it('rejects malformed ids', () => {
    expect(isDocumentKeyChars('')).toBe(false)
    expect(isDocumentKeyChars('ABC123')).toBe(false)
    expect(isDocumentKeyChars('abc-def')).toBe(false)
  })
})

describe('generateDocumentKey', () => {
  it('produces keys of the default length from the allowed charset', () => {
    for (let i = 0; i < 100; i++) {
      const key = generateDocumentKey()
      expect(key).toHaveLength(KEY_LENGTH)
      expect(isDocumentKey(key)).toBe(true)
    }
  })

  it('produces keys of a custom length', () => {
    for (let i = 0; i < 100; i++) {
      const key = generateDocumentKey(10)
      expect(key).toHaveLength(10)
      expect(isDocumentKey(key, 10)).toBe(true)
    }
  })

  it('produces unique keys', () => {
    const seen = new Set(Array.from({ length: 1000 }, generateDocumentKey))
    expect(seen.size).toBe(1000)
  })
})

describe('isUniqueKeyViolation', () => {
  it('detects a Postgres unique_violation', () => {
    const error = new Error('duplicate key value violates unique constraint "documents_key_key"')
    ;(error as Error & { code?: string }).code = '23505'
    expect(isUniqueKeyViolation(error)).toBe(true)
  })

  it('detects a SQLite unique constraint failure', () => {
    const error = new Error('UNIQUE constraint failed: documents.key')
    ;(error as Error & { errcode?: number }).errcode = 2067
    expect(isUniqueKeyViolation(error)).toBe(true)
  })

  it('falls back to the message for unique constraint failures', () => {
    expect(isUniqueKeyViolation(new Error('UNIQUE constraint failed: documents.key'))).toBe(true)
  })

  it('rejects unrelated errors', () => {
    expect(isUniqueKeyViolation(new Error('connection refused'))).toBe(false)
    expect(isUniqueKeyViolation('not an error')).toBe(false)
    expect(isUniqueKeyViolation(null)).toBe(false)
  })
})

describe('normalizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeName('  Meeting notes  ')).toBe('Meeting notes')
  })

  it('rejects empty names', () => {
    expect(() => normalizeName('')).toThrow('name is required')
    expect(() => normalizeName('   ')).toThrow('name is required')
  })

  it('rejects names over the length limit', () => {
    expect(() => normalizeName('x'.repeat(MAX_NAME_LENGTH + 1))).toThrow('limit')
  })

  it('accepts names at the length limit', () => {
    expect(normalizeName('x'.repeat(MAX_NAME_LENGTH))).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('contentByteSize', () => {
  it('counts UTF-8 bytes', () => {
    expect(contentByteSize('hello')).toBe(5)
    expect(contentByteSize('héllo')).toBe(6)
  })
})

describe('assertContentWithinLimit', () => {
  it('accepts content within the limit', () => {
    expect(() => assertContentWithinLimit('x'.repeat(MAX_CONTENT_BYTES - 1), MAX_CONTENT_BYTES)).not.toThrow()
  })

  it('rejects content over the 1 MB byte limit', () => {
    expect(() => assertContentWithinLimit('x'.repeat(MAX_CONTENT_BYTES + 1), MAX_CONTENT_BYTES + 1000)).toThrow(
      '1 MB limit',
    )
  })

  it('rejects content over the character limit', () => {
    expect(() => assertContentWithinLimit('x'.repeat(100), 50)).toThrow('50-character limit')
  })
})

describe('row mapping', () => {
  const row = {
    id: 1,
    key: 'a1b2c3',
    name: 'Notes',
    content: 'body',
    document_type: 'text',
    updated_by: '203.0.113.7',
    updated_at: new Date('2026-08-02T12:00:00.000Z'),
  }

  it('maps summary rows', () => {
    expect(toDocumentSummary(row)).toEqual({
      id: row.key,
      name: 'Notes',
      documentType: 'text',
      updatedAt: '2026-08-02T12:00:00.000Z',
      updatedBy: '203.0.113.7',
    })
  })

  it('maps full rows', () => {
    expect(toDocument(row)).toEqual({
      id: row.key,
      name: 'Notes',
      documentType: 'text',
      content: 'body',
      updatedAt: '2026-08-02T12:00:00.000Z',
      updatedBy: '203.0.113.7',
    })
  })

  it('normalizes string timestamps', () => {
    expect(toDocument({ ...row, updated_at: '2026-08-02T12:00:00.000Z' }).updatedAt).toBe('2026-08-02T12:00:00.000Z')
  })
})
