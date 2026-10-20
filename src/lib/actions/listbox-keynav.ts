/**
 * True when a navigation key is pressed with a modifier. Such a key belongs to
 * the text field (Shift+Home selects text, Ctrl+Arrow moves by word) rather
 * than the listbox highlight, so the keydown handler must let it through.
 */
export function isModifiedNavKey(event: KeyboardEvent): boolean {
  const navKey = event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End'
  return navKey && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
}
