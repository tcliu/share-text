import { describe, expect, it } from 'vitest'
import * as diff from 'diff'
import { buildSideBySideRows } from '$lib/version-diff'

describe('buildSideBySideRows', () => {
  it('pairs removed and added blocks into aligned context rows', () => {
    const rows = buildSideBySideRows('a\nb\nc\n', 'a\nB\nc\n', diff)

    expect(rows).toEqual([
      { left: 'a', right: 'a', leftKind: 'context', rightKind: 'context' },
      { left: 'b', right: 'B', leftKind: 'removed', rightKind: 'added' },
      { left: 'c', right: 'c', leftKind: 'context', rightKind: 'context' },
    ])
  })

  it('treats a trailing-newline-only difference as identical', () => {
    const rows = buildSideBySideRows('a\nb', 'a\nb\n', diff)

    expect(rows).toEqual([
      { left: 'a', right: 'a', leftKind: 'context', rightKind: 'context' },
      { left: 'b', right: 'b', leftKind: 'context', rightKind: 'context' },
    ])
  })

  it('pads the empty counterpart when removed and added line counts differ', () => {
    const rows = buildSideBySideRows('a\nb\n', 'a\nx\ny\n', diff)

    expect(rows).toEqual([
      { left: 'a', right: 'a', leftKind: 'context', rightKind: 'context' },
      { left: 'b', right: 'x', leftKind: 'removed', rightKind: 'added' },
      { left: '', right: 'y', leftKind: 'empty', rightKind: 'added' },
    ])
  })

  it('shows removed-only blocks with an empty right cell', () => {
    const rows = buildSideBySideRows('a\nb\n', 'a\n', diff)

    expect(rows).toEqual([
      { left: 'a', right: 'a', leftKind: 'context', rightKind: 'context' },
      { left: 'b', right: '', leftKind: 'removed', rightKind: 'empty' },
    ])
  })

  it('renders empty content as a clean added block without a phantom removed line', () => {
    const rows = buildSideBySideRows('', 'x\n', diff)

    expect(rows).toEqual([{ left: '', right: 'x', leftKind: 'empty', rightKind: 'added' }])
  })

  it('renders two empty contents as no rows', () => {
    const rows = buildSideBySideRows('', '', diff)

    expect(rows).toEqual([])
  })
})
