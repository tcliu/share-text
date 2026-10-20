import { describe, expect, it } from 'vitest'
import { normalizeCard, resolveCardPayload } from './card'

describe('normalizeCard', () => {
  it('normalizes the runtime profile: absent and whitespace become null, a value is trimmed', () => {
    const base = { id: 'ui-lib', name: 'UI Library' }
    expect(normalizeCard(base).profile).toBeNull()
    expect(normalizeCard({ ...base, profile: '   ' }).profile).toBeNull()
    expect(normalizeCard({ ...base, profile: '  prod  ' }).profile).toBe('prod')
  })

  it('defaults the remaining optional fields', () => {
    const card = normalizeCard({ id: 'ui-lib', name: 'UI Library' })
    expect(card).toEqual({
      id: 'ui-lib',
      name: 'UI Library',
      icon: null,
      description: null,
      branch: null,
      repo: null,
      status: 'Active',
      url: null,
      profile: null,
      tags: [],
      active: true,
    })
  })

  it('requires id and name', () => {
    expect(() => normalizeCard({ name: 'UI Library' })).toThrow(/id/)
    expect(() => normalizeCard({ id: 'ui-lib' })).toThrow(/name/)
  })

  it('accepts only recognized statuses and false spellings', () => {
    expect(normalizeCard({ id: 'a', name: 'b', status: 'Inactive' }).status).toBe('Inactive')
    expect(normalizeCard({ id: 'a', name: 'b', status: 'unknown' }).status).toBe('Active')
    expect(normalizeCard({ id: 'a', name: 'b', active: 'false' }).active).toBe(false)
    expect(normalizeCard({ id: 'a', name: 'b', active: 'nope' }).active).toBe(true)
  })

  it('coerces, trims, and dedupes tags while dropping empties', () => {
    expect(normalizeCard({ id: 'a', name: 'b', tags: 'one, two, one' }).tags).toEqual(['one', 'two'])
    expect(normalizeCard({ id: 'a', name: 'b', tags: ['x', '', ' X ', 3] }).tags).toEqual(['x', '3'])
  })
})

describe('resolveCardPayload', () => {
  it('prefers a `self` envelope over the whole body', () => {
    expect(resolveCardPayload({ id: 'outer', self: { id: 'inner' } })).toEqual({ id: 'inner' })
    expect(resolveCardPayload({ id: 'flat' })).toEqual({ id: 'flat' })
  })

  it('rejects a non-object or missing card', () => {
    expect(() => resolveCardPayload(null)).toThrow(/JSON object/)
    expect(() => resolveCardPayload('nope')).toThrow(/JSON object/)
    expect(() => resolveCardPayload({ self: 42 })).toThrow(/missing a card/)
  })
})
