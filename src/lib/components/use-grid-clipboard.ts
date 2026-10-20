import { tick } from 'svelte'
import { rectOfKeys } from './grid-utils'
import type { createGridModel } from './use-grid-model.svelte'

type Model = ReturnType<typeof createGridModel>

export function createGridClipboard() {
  let clipboard = ''

  function copy(text: string) {
    clipboard = text
    navigator.clipboard
      ?.writeText(text)
      .then(() => {})
      .catch(err => console.warn('[GridClipboard] copy failed:', err))
  }

  function paste(ri: number, ci: number, applyText: (ri: number, ci: number, text: string) => void) {
    if (clipboard) {
      applyText(ri, ci, clipboard)
      return
    }
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then(text => {
          if (text) applyText(ri, ci, text)
        })
        .catch(err => console.warn('[GridClipboard] paste read failed:', err))
    }
  }

  return { copy, paste }
}

export interface GridClipboardSelectionOptions {
  clipboard: ReturnType<typeof createGridClipboard>
  model: Model
  getHighlightKeys: () => Set<string>
  getSelectedCell: () => { ri: number; ci: number } | null
  focusCellBox: (ri: number, ci: number) => void
  clearSelectedCellValues: () => void
}

// The selection<->clipboard bridge: serializes the highlighted rectangle to TSV
// on copy/cut and applies pasted text at the active cell. The OS clipboard
// itself stays in `createGridClipboard`; this composable turns selection state
// into clipboard content and back.
export function createGridClipboardActions(opts: GridClipboardSelectionOptions) {
  const { clipboard, model } = opts

  function copySelection() {
    const highlightKeys = opts.getHighlightKeys()
    if (highlightKeys.size === 0) return
    const b = rectOfKeys(highlightKeys)
    if (!b) return
    const lines: string[] = []
    for (let r = b.r1; r <= b.r2; r++) {
      const parts: string[] = []
      for (let c = b.c1; c <= b.c2; c++) {
        parts.push(model.rows[r]?.cells[c]?.value ?? '')
      }
      lines.push(parts.join('\t'))
    }
    const text = lines.join('\n')
    if (text) clipboard.copy(text)
  }

  // Cut mirrors copy: the copied rectangle stays in the clipboard while the
  // source cells are blanked. The selection is kept, matching copy.
  function cutSelection() {
    if (opts.getHighlightKeys().size === 0) return
    copySelection()
    opts.clearSelectedCellValues()
  }

  function pasteSelection() {
    const cell = opts.getSelectedCell()
    if (!cell) return
    const { ri, ci } = cell
    clipboard.paste(ri, ci, (r, c, text) => {
      model.applyPastedText(r, c, text)
      // applyPastedText prunes navigation-appended pending rows before growing
      // the matrix again, so pasting into a freshly appended row destroys the
      // focused cell and drops focus to <body>. Restore the box so undo and
      // arrow navigation stay inside the grid.
      tick().then(() => opts.focusCellBox(r, c))
    })
  }

  return { copySelection, cutSelection, pasteSelection }
}
