import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from '$lib/document-drafts'

describe('document-drafts localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored for the id', () => {
    expect(loadDraft('a')).toBeNull()
  })

  it('saves and loads a draft for a document id', () => {
    saveDraft('a', 'hello world')
    expect(loadDraft('a')).toBe('hello world')
  })

  it('keeps drafts isolated per document id', () => {
    saveDraft('a', 'first')
    saveDraft('b', 'second')
    expect(loadDraft('a')).toBe('first')
    expect(loadDraft('b')).toBe('second')
  })

  it('overwrites a previously saved draft', () => {
    saveDraft('a', 'first')
    saveDraft('a', 'second')
    expect(loadDraft('a')).toBe('second')
  })

  it('clears a stored draft', () => {
    saveDraft('a', 'hello world')
    clearDraft('a')
    expect(loadDraft('a')).toBeNull()
  })

  it('clearing a missing draft is a no-op', () => {
    clearDraft('missing')
    expect(loadDraft('missing')).toBeNull()
  })

  it('stores an empty string draft', () => {
    saveDraft('a', '')
    expect(loadDraft('a')).toBe('')
  })
})
