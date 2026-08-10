import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadEditorPreviewSplit, saveEditorPreviewSplit } from '$lib/editor-preview-split'

describe('editor-preview-split localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the default when nothing is stored', () => {
    expect(loadEditorPreviewSplit()).toBe(50)
  })

  it('saves and loads a split percentage', () => {
    saveEditorPreviewSplit(65)
    expect(loadEditorPreviewSplit()).toBe(65)
  })

  it('clamps saved values to the allowed range', () => {
    saveEditorPreviewSplit(95)
    expect(loadEditorPreviewSplit()).toBe(90)
    saveEditorPreviewSplit(5)
    expect(loadEditorPreviewSplit()).toBe(10)
  })

  it('rounds fractional percentages', () => {
    saveEditorPreviewSplit(50.6)
    expect(loadEditorPreviewSplit()).toBe(51)
  })

  it('falls back to the stored value when localStorage.getItem throws', () => {
    saveEditorPreviewSplit(40)
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(loadEditorPreviewSplit()).toBe(40)
    getItem.mockRestore()
  })
})