export interface DiffRow {
  left: string
  right: string
  leftKind: 'context' | 'removed' | 'empty'
  rightKind: 'context' | 'added' | 'empty'
}

function splitDiffLines(value: string): string[] {
  if (value === '') return ['']
  const lines = value.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

// Normalizes a non-empty string to end with a newline. jsdiff would otherwise
// report a trailing-newline-only difference as a removed/added pair of
// identical text. An empty string stays empty (it means "no lines", and
// adding a phantom newline would show a spurious removed line).
function normalizeNewlineEnding(value: string): string {
  return value === '' ? value : value.replace(/\n?$/, '\n')
}

// Pairs the `removed`/`added` blocks `diffLines` emits for a changed region
// into aligned side-by-side rows, so replacements line up across the two
// panes (extra removed or added lines pad their empty counterpart). Both
// non-empty inputs are normalized to end with a newline first, since jsdiff
// otherwise reports a trailing-newline-only difference as a removed/added
// pair of identical text.
export function buildSideBySideRows(
  oldContent: string,
  newContent: string,
  diffLib: typeof import('diff'),
): DiffRow[] {
  const parts = diffLib.diffLines(
    normalizeNewlineEnding(oldContent),
    normalizeNewlineEnding(newContent),
  )
  const rows: DiffRow[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.added) {
      for (const line of splitDiffLines(part.value)) {
        rows.push({ left: '', right: line, leftKind: 'empty', rightKind: 'added' })
      }
    } else if (part.removed) {
      const removedLines = splitDiffLines(part.value)
      const next = parts[i + 1]
      if (next?.added) {
        const addedLines = splitDiffLines(next.value)
        const count = Math.max(removedLines.length, addedLines.length)
        for (let j = 0; j < count; j++) {
          const hasLeft = j < removedLines.length
          const hasRight = j < addedLines.length
          rows.push({
            left: hasLeft ? removedLines[j] : '',
            right: hasRight ? addedLines[j] : '',
            leftKind: hasLeft ? 'removed' : 'empty',
            rightKind: hasRight ? 'added' : 'empty',
          })
        }
        i++
      } else {
        for (const line of removedLines) {
          rows.push({ left: line, right: '', leftKind: 'removed', rightKind: 'empty' })
        }
      }
    } else {
      for (const line of splitDiffLines(part.value)) {
        rows.push({ left: line, right: line, leftKind: 'context', rightKind: 'context' })
      }
    }
  }
  return rows
}
