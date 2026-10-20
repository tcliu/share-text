import { describe, expect, it } from 'vitest'

import {
  columnLetter,
  compareGridValues,
  isEmptyValue,
  keyOf,
  keysInRect,
  matrixEqual,
  rectOfKeys,
} from '../grid-utils'
import { dimensionMetrics, iconPadRatio, resolveSize, sizeVarStyle } from '../size-metrics'

// The grid's pure helpers and the history stack carry the behaviour the grid
// composable only wires up: cell keys, value comparison, the size metrics every
// sized control derives, and the undo/redo snapshots.

describe('grid-utils', () => {
  it('keys a cell by row and column', () => {
    expect(keyOf(2, 5)).toBe('2:5')
  })

  it('treats blank values as empty', () => {
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('  ')).toBe(true)
    expect(isEmptyValue('a')).toBe(false)
  })

  it('compares matrices by content', () => {
    expect(matrixEqual([['a']], [['a']])).toBe(true)
    expect(matrixEqual([['a']], [['b']])).toBe(false)
    expect(matrixEqual([['a']], [['a', 'b']])).toBe(false)
    expect(matrixEqual([], [])).toBe(true)
  })

  it('spans a rectangle of cell keys', () => {
    const keys = keysInRect(0, 0, 1, 1)
    expect([...keys].sort()).toEqual(['0:0', '0:1', '1:0', '1:1'])
    expect(rectOfKeys(keys)).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 })
  })

  it('returns no rectangle for an empty selection', () => {
    expect(rectOfKeys(new Set())).toBeNull()
  })

  it('labels columns like a spreadsheet', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
  })

  it('compares numbers numerically and everything else as text', () => {
    expect(compareGridValues('2', '10')).toBeLessThan(0)
    expect(compareGridValues('apple', 'Banana')).toBeLessThan(0)
    expect(compareGridValues('same', 'same')).toBe(0)
  })
})

describe('size-metrics', () => {
  it('resolves named sizes and numbers onto the shared axis', () => {
    expect(resolveSize('md')).toBe(16)
    expect(resolveSize(12)).toBe(12)
    expect(resolveSize('nope' as never)).toBe(16)
  })

  it('derives every metric as a ratio of the size dimension', () => {
    const metrics = dimensionMetrics('md', { font: 0.875, line: 1.1607 })
    expect(metrics.font).toBeCloseTo(14, 5)
    expect(metrics.line).toBeCloseTo(18.5712, 3)
  })

  it('derives the icon padding so the icon box matches the text row', () => {
    const ratios = { padY: 0.45, line: 1.1607, icon: 1 }
    expect(iconPadRatio(ratios)).toBeCloseTo(0.45 + (1.1607 - 1) / 2, 5)
  })

  it('emits prefixed custom properties for the metrics', () => {
    expect(sizeVarStyle('btn', { padX: 10, fontSize: 14 })).toBe('--btn-pad-x:10px;--btn-font-size:14px')
  })
})
