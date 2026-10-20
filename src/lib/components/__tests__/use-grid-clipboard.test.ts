import { afterEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import { createGridClipboard, createGridClipboardActions } from '../use-grid-clipboard'
import type { createGridModel } from '../use-grid-model.svelte'

type Model = ReturnType<typeof createGridModel>

function fakeModel(values: string[][]): Model {
  return {
    rows: values.map((cells, ri) => ({
      id: ri,
      cells: cells.map((value, ci) => ({ id: ri * 100 + ci, value, committed: true })),
    })),
    applyPastedText: vi.fn(),
  } as unknown as Model
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGridClipboard', () => {
  it('writes to the OS clipboard and serves pastes from the in-memory copy', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const clipboard = createGridClipboard()
    clipboard.copy('a\tb')
    expect(writeText).toHaveBeenCalledWith('a\tb')

    // A later paste prefers the in-memory copy over re-reading the OS clipboard.
    const apply = vi.fn()
    clipboard.paste(0, 0, apply)
    expect(apply).toHaveBeenCalledWith(0, 0, 'a\tb')
  })

  it('falls back to reading the OS clipboard when nothing was copied yet', async () => {
    const readText = vi.fn().mockResolvedValue('pasted')
    vi.stubGlobal('navigator', { clipboard: { readText } })

    const clipboard = createGridClipboard()
    const apply = vi.fn()
    clipboard.paste(1, 1, apply)
    await Promise.resolve()
    await Promise.resolve()
    expect(apply).toHaveBeenCalledWith(1, 1, 'pasted')
  })
})

describe('createGridClipboardActions', () => {
  it('serializes the highlighted rectangle to TSV on copy', () => {
    const model = fakeModel([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ])
    const clipboard = { copy: vi.fn(), paste: vi.fn() }
    const actions = createGridClipboardActions({
      clipboard,
      model,
      getHighlightKeys: () => new Set(['0:0', '0:1', '1:1']),
      getSelectedCell: () => ({ ri: 0, ci: 0 }),
      focusCellBox: vi.fn(),
      clearSelectedCellValues: vi.fn(),
    })

    actions.copySelection()
    expect(clipboard.copy).toHaveBeenCalledWith('a\tb\nd\te')
  })

  it('does nothing on copy with an empty highlight', () => {
    const clipboard = { copy: vi.fn(), paste: vi.fn() }
    const actions = createGridClipboardActions({
      clipboard,
      model: fakeModel([['a']]),
      getHighlightKeys: () => new Set(),
      getSelectedCell: () => null,
      focusCellBox: vi.fn(),
      clearSelectedCellValues: vi.fn(),
    })
    actions.copySelection()
    expect(clipboard.copy).not.toHaveBeenCalled()
  })

  it('copies then blanks the source cells on cut', () => {
    const clipboard = { copy: vi.fn(), paste: vi.fn() }
    const clearSelectedCellValues = vi.fn()
    const actions = createGridClipboardActions({
      clipboard,
      model: fakeModel([['a']]),
      getHighlightKeys: () => new Set(['0:0']),
      getSelectedCell: () => ({ ri: 0, ci: 0 }),
      focusCellBox: vi.fn(),
      clearSelectedCellValues,
    })

    actions.cutSelection()
    expect(clipboard.copy).toHaveBeenCalledWith('a')
    expect(clearSelectedCellValues).toHaveBeenCalledTimes(1)
  })

  it('applies a paste at the selected cell and restores the box focus', async () => {
    const model = fakeModel([['']])
    const focusCellBox = vi.fn()
    const clipboard = {
      copy: vi.fn(),
      paste: vi.fn((ri: number, ci: number, apply: (ri: number, ci: number, text: string) => void) => {
        apply(ri, ci, 'x\ty')
      }),
    }
    const actions = createGridClipboardActions({
      clipboard,
      model,
      getHighlightKeys: () => new Set(),
      getSelectedCell: () => ({ ri: 0, ci: 0 }),
      focusCellBox,
      clearSelectedCellValues: vi.fn(),
    })

    actions.pasteSelection()
    expect(model.applyPastedText).toHaveBeenCalledWith(0, 0, 'x\ty')
    await tick()
    expect(focusCellBox).toHaveBeenCalledWith(0, 0)
  })
})
