import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCUMENT_NAME,
  KEY_LENGTH,
  MAX_CONTENT_BYTES,
  MAX_NAME_LENGTH,
  assertContentWithinLimit,
  contentByteSize,
  generateDocumentKey,
  isDocumentKey,
  nextDefaultDocumentName,
  normalizeName,
  toDocument,
  toDocumentSummary,
} from '$lib/server/documents'

describe('isDocumentKey', () => {
  it('accepts six lowercase alphanumeric characters', () => {
    expect(isDocumentKey('a1b2c3')).toBe(true)
    expect(isDocumentKey('000000')).toBe(true)
    expect(isDocumentKey('zzz999')).toBe(true)
  })

  it('rejects malformed values', () => {
    expect(isDocumentKey('')).toBe(false)
    expect(isDocumentKey('abcde')).toBe(false)
    expect(isDocumentKey('abcdefg')).toBe(false)
    expect(isDocumentKey('ABC123')).toBe(false)
    expect(isDocumentKey('abc-def')).toBe(false)
  })
})

describe('generateDocumentKey', () => {
  it('produces keys of the expected length from the allowed charset', () => {
    for (let i = 0; i < 100; i++) {
      const key = generateDocumentKey()
      expect(key).toHaveLength(KEY_LENGTH)
      expect(isDocumentKey(key)).toBe(true)
    }
  })

  it('produces unique keys', () => {
    const seen = new Set(Array.from({ length: 1000 }, generateDocumentKey))
    expect(seen.size).toBe(1000)
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

describe('nextDefaultDocumentName', () => {
  it('uses the default name when it is available', () => {
    expect(nextDefaultDocumentName([])).toBe(DEFAULT_DOCUMENT_NAME)
    expect(nextDefaultDocumentName(['Notes', 'Todo'])).toBe(DEFAULT_DOCUMENT_NAME)
  })

  it('appends an index starting at 1 when the default name is taken', () => {
    expect(nextDefaultDocumentName([DEFAULT_DOCUMENT_NAME])).toBe(`${DEFAULT_DOCUMENT_NAME} 1`)
    expect(nextDefaultDocumentName([DEFAULT_DOCUMENT_NAME, `${DEFAULT_DOCUMENT_NAME} 1`])).toBe(
      `${DEFAULT_DOCUMENT_NAME} 2`,
    )
  })

  it('fills the first available index, reusing gaps', () => {
    expect(nextDefaultDocumentName([DEFAULT_DOCUMENT_NAME, `${DEFAULT_DOCUMENT_NAME} 2`])).toBe(
      `${DEFAULT_DOCUMENT_NAME} 1`,
    )
    expect(nextDefaultDocumentName([DEFAULT_DOCUMENT_NAME, `${DEFAULT_DOCUMENT_NAME} 1`, `${DEFAULT_DOCUMENT_NAME} 2`])).toBe(
      `${DEFAULT_DOCUMENT_NAME} 3`,
    )
  })

  it('ignores unrelated indexed names', () => {
    expect(nextDefaultDocumentName([DEFAULT_DOCUMENT_NAME, 'Untitled Copy 1'])).toBe(`${DEFAULT_DOCUMENT_NAME} 1`)
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
    expect(() => assertContentWithinLimit('x'.repeat(MAX_CONTENT_BYTES - 1))).not.toThrow()
  })

  it('rejects content over the limit', () => {
    expect(() => assertContentWithinLimit('x'.repeat(MAX_CONTENT_BYTES + 1))).toThrow('1 MB limit')
  })
})

describe('row mapping', () => {
  const row = {
    id: 1,
    key: 'a1b2c3',
    name: 'Notes',
    content: 'body',
    updated_by: '203.0.113.7',
    updated_at: new Date('2026-08-02T12:00:00.000Z'),
  }

  it('maps summary rows', () => {
    expect(toDocumentSummary(row)).toEqual({
      id: row.key,
      name: 'Notes',
      updatedAt: '2026-08-02T12:00:00.000Z',
      updatedBy: '203.0.113.7',
    })
  })

  it('maps full rows', () => {
    expect(toDocument(row)).toEqual({
      id: row.key,
      name: 'Notes',
      content: 'body',
      updatedAt: '2026-08-02T12:00:00.000Z',
      updatedBy: '203.0.113.7',
    })
  })

  it('normalizes string timestamps', () => {
    expect(toDocument({ ...row, updated_at: '2026-08-02T12:00:00.000Z' }).updatedAt).toBe('2026-08-02T12:00:00.000Z')
  })
})
