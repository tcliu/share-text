// Owned-node registry for the grid. Cells, cell editors, and the row/column
// selectors register their own nodes through Svelte actions and are removed on
// destroy, so focus and edit transitions reach an owned node without querying
// the DOM. Keys are the current row/column indices, and an action re-keys when
// its parameters change because inserting a row or column shifts them.
import type { Action } from 'svelte/action'

export interface GridCellRefs {
  /** The `<td>`/`<th>` box of a cell, focusable for keyboard selection. */
  cellBox(ri: number, ci: number): HTMLElement | null
  /** The `<textarea>` editor inside a cell. */
  cellInput(ri: number, ci: number): HTMLTextAreaElement | null
  /** The row-number selector cell. */
  rowSelector(ri: number): HTMLElement | null
  /** The column-letter selector header cell. */
  colSelector(ci: number): HTMLElement | null
  cellBoxRef: Action<HTMLElement, { ri: number; ci: number }>
  cellInputRef: Action<HTMLTextAreaElement, { ri: number; ci: number }>
  rowSelectorRef: Action<HTMLElement, { ri: number }>
  colSelectorRef: Action<HTMLElement, { ci: number }>
}

const cellKey = (ri: number, ci: number): string => `${ri}:${ci}`

// Register `node` under `keyOf(params)` and re-key on update. Destroy removes
// the entry only when it still points at this node, so a node re-keyed by a
// later instance cannot be removed by a stale one.
function refAction<N extends HTMLElement, K, P extends object>(store: Map<K, N>, keyOf: (params: P) => K) {
  return (node: N, params: P) => {
    let key = keyOf(params)
    store.set(key, node)
    return {
      update(next: P) {
        const nextKey = keyOf(next)
        if (nextKey === key) return
        if (store.get(key) === node) store.delete(key)
        key = nextKey
        store.set(key, node)
      },
      destroy() {
        if (store.get(key) === node) store.delete(key)
      },
    }
  }
}

export function createGridCellRefs(): GridCellRefs {
  const boxes = new Map<string, HTMLElement>()
  const inputs = new Map<string, HTMLTextAreaElement>()
  const rowSelectors = new Map<number, HTMLElement>()
  const colSelectors = new Map<number, HTMLElement>()

  return {
    cellBox: (ri, ci) => boxes.get(cellKey(ri, ci)) ?? null,
    cellInput: (ri, ci) => inputs.get(cellKey(ri, ci)) ?? null,
    rowSelector: ri => rowSelectors.get(ri) ?? null,
    colSelector: ci => colSelectors.get(ci) ?? null,
    cellBoxRef: refAction(boxes, p => cellKey(p.ri, p.ci)),
    cellInputRef: refAction(inputs, p => cellKey(p.ri, p.ci)),
    rowSelectorRef: refAction(rowSelectors, p => p.ri),
    colSelectorRef: refAction(colSelectors, p => p.ci),
  }
}
