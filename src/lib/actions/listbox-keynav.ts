import { flushSync } from 'svelte'
import type { ListSelection } from './use-list-selection.svelte'

/**
 * True when a navigation key is pressed with a modifier. Such a key belongs to
 * the text field (Shift+Home selects text, Ctrl+Arrow moves by word) rather
 * than the listbox highlight, so the keydown handler must let it through.
 */
export function isModifiedNavKey(event: KeyboardEvent): boolean {
  const navKey =
    event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End'
  return navKey && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
}

/**
 * Move the listbox highlight and reveal the new active row, flushing
 * synchronously so a held key's OS repeat paints the highlight immediately
 * instead of only on keyup. `reveal` scrolls the active row into view.
 */
export function moveListSelection(
  selection: ListSelection,
  direction: 'up' | 'down' | 'first' | 'last',
  count: number,
  reveal: () => void,
): void {
  flushSync(() => {
    selection.move(direction, count)
    reveal()
  })
}
