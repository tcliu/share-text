import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSplitPaneWidth, saveSplitPaneWidth } from '$lib/split-pane'

describe('split-pane localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the default width when nothing is stored', () => {
    expect(loadSplitPaneWidth()).toBe(288)
  })

  it('saves and loads a pane width', () => {
    saveSplitPaneWidth(400)
    expect(loadSplitPaneWidth()).toBe(400)
  })

  it('clamps saved widths to the allowed range', () => {
    saveSplitPaneWidth(1000)
    expect(loadSplitPaneWidth()).toBe(480)
    saveSplitPaneWidth(50)
    expect(loadSplitPaneWidth()).toBe(160)
  })

  it('falls back to the stored value when localStorage.getItem throws', () => {
    saveSplitPaneWidth(360)
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(loadSplitPaneWidth()).toBe(360)
    getItem.mockRestore()
  })
})
