#!/usr/bin/env node

// _pickers.mjs — shared interactive-prompt helpers for the CLI scripts:
// the selection-list renderer reused by every picker and menu, plus the
// cancellable ask that maps a closed stdin to a cancel result.
import { c } from './_terminal.mjs'

export const CHECKLIST_HINT = 'Space: toggle | Enter: confirm | q: cancel'

// Render a selection list. `checkboxes` draws the [x] markers used by the
// multi-select pickers; single-choice menus show only the cursor.
export function renderList({ formatRow, hint, checkboxes = false }) {
  return (items, state) => {
    const lines = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const cursor = i === state.cursor ? `${c.cyan}>${c.reset}` : ' '
      const marker = checkboxes ? `${state.selected.has(i) ? `${c.green}[x]${c.reset}` : '[ ]'} ` : ''
      lines.push(` ${cursor} ${marker}${formatRow(item)}`)
    }
    lines.push('', `${c.dim}${hint}${c.reset}`)
    return lines
  }
}

// ctx.ask never settles once stdin is closed (readline drops the pending
// question), so race it against stream end and map EOF to cancel. Without
// this the process would exit silently instead of reporting the cancellation.
export function askCancellable(ctx, prompt) {
  if (process.stdin.readableEnded) {
    return Promise.resolve(null)
  }
  let onEnd
  const eof = new Promise(resolve => {
    onEnd = () => resolve(null)
    process.stdin.once('end', onEnd)
  })
  return Promise.race([ctx.ask(prompt), eof]).finally(() => {
    process.stdin.removeListener('end', onEnd)
  })
}
