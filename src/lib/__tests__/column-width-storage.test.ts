import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadColumnWidths, saveColumnWidths } from '$lib/column-width-storage'

describe('column-width-storage localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(loadColumnWidths('csv-preview')).toBeNull()
  })

  it('saves and loads a widths array per key', () => {
    saveColumnWidths('csv-preview', [162, 243])
    expect(loadColumnWidths('csv-preview')).toEqual([162, 243])
    // Different keys stay independent.
    expect(loadColumnWidths('properties-preview')).toBeNull()
  })

  it('rounds fractional widths', () => {
    saveColumnWidths('csv-preview', [162.4, 243.6])
    expect(loadColumnWidths('csv-preview')).toEqual([162, 244])
  })

  it('ignores non-numeric entries in stored data', () => {
    localStorage.setItem('share-text:column-widths:csv-preview', JSON.stringify([162, 'wide', null, 243]))
    expect(loadColumnWidths('csv-preview')).toEqual([162, 243])
  })

  it('returns null when localStorage.getItem throws', () => {
    saveColumnWidths('csv-preview', [200, 300])
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(loadColumnWidths('csv-preview')).toBeNull()
    getItem.mockRestore()
  })

  it('clamps non-finite and negative widths to the default', () => {
    saveColumnWidths('csv-preview', [Number.POSITIVE_INFINITY, -4, 162.4])
    expect(loadColumnWidths('csv-preview')).toEqual([128, 128, 162])
  })
})
