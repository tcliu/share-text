import { describe, expect, it } from 'vitest'
import {
  APP_SHELL_DEFAULT_WIDTH,
  APP_SHELL_MAX_WIDTH,
  APP_SHELL_MIN_WIDTH,
  APP_SHELL_RAIL_WIDTH,
  clampPaneWidth,
  collapsesToRail,
  combineNestingOverlay,
  loadPaneSize,
  resolveDrawerFloating,
  savePaneSize,
  shouldSuppressFloatingPane,
} from './app-shell'

describe('clampPaneWidth', () => {
  it('rounds and clamps into range', () => {
    expect(clampPaneWidth(200.6, APP_SHELL_MIN_WIDTH, APP_SHELL_MAX_WIDTH, APP_SHELL_DEFAULT_WIDTH)).toBe(201)
    expect(clampPaneWidth(50, APP_SHELL_MIN_WIDTH, APP_SHELL_MAX_WIDTH, APP_SHELL_DEFAULT_WIDTH)).toBe(
      APP_SHELL_MIN_WIDTH,
    )
    expect(clampPaneWidth(900, APP_SHELL_MIN_WIDTH, APP_SHELL_MAX_WIDTH, APP_SHELL_DEFAULT_WIDTH)).toBe(
      APP_SHELL_MAX_WIDTH,
    )
  })

  it('falls back on non-finite input', () => {
    expect(clampPaneWidth(Number.NaN, APP_SHELL_MIN_WIDTH, APP_SHELL_MAX_WIDTH, APP_SHELL_DEFAULT_WIDTH)).toBe(
      APP_SHELL_DEFAULT_WIDTH,
    )
  })
})

describe('collapsesToRail', () => {
  it('collapses at or below the rail width', () => {
    expect(collapsesToRail(APP_SHELL_RAIL_WIDTH, APP_SHELL_RAIL_WIDTH)).toBe(true)
    expect(collapsesToRail(APP_SHELL_RAIL_WIDTH + 1, APP_SHELL_RAIL_WIDTH)).toBe(false)
  })
})

describe('resolveDrawerFloating', () => {
  it('pins explicit modes regardless of layout', () => {
    expect(resolveDrawerFloating('docked', false)).toBe(false)
    expect(resolveDrawerFloating('docked', true)).toBe(false)
    expect(resolveDrawerFloating('floating', false)).toBe(true)
    expect(resolveDrawerFloating('floating', true)).toBe(true)
  })

  it('floats below the desktop breakpoint in auto mode', () => {
    expect(resolveDrawerFloating('auto', false)).toBe(true)
    expect(resolveDrawerFloating('auto', true)).toBe(false)
  })
})

describe('shouldSuppressFloatingPane', () => {
  it('suppresses only a floating pane under an open ancestor overlay', () => {
    expect(shouldSuppressFloatingPane(true, true)).toBe(true)
    expect(shouldSuppressFloatingPane(true, false)).toBe(false)
    expect(shouldSuppressFloatingPane(false, true)).toBe(false)
    expect(shouldSuppressFloatingPane(false, false)).toBe(false)
  })
})

describe('combineNestingOverlay', () => {
  it('publishes self or ancestor openness so suppression chains', () => {
    expect(combineNestingOverlay(false, false)).toBe(false)
    expect(combineNestingOverlay(true, false)).toBe(true)
    expect(combineNestingOverlay(false, true)).toBe(true)
    expect(combineNestingOverlay(true, true)).toBe(true)
  })
})

describe('pane persistence without a storage key', () => {
  it('loads the fallback and never touches storage', () => {
    expect(loadPaneSize(undefined, APP_SHELL_DEFAULT_WIDTH, APP_SHELL_MIN_WIDTH, APP_SHELL_MAX_WIDTH)).toBe(
      APP_SHELL_DEFAULT_WIDTH,
    )
  })

  it('saves as a no-op without a storage key', () => {
    expect(() => savePaneSize(undefined, 300)).not.toThrow()
  })
})
