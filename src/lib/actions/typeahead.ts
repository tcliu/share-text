/**
 * Native-control-style type-ahead. Typing a letter moves the active item to the
 * next option, after the current active item and wrapping, whose label starts
 * with that letter. So repeated presses cycle through same-letter options
 * (Four -> Fourteen -> Four), and pressing a letter while the active item
 * already matches advances past it rather than staying put. Holding Shift
 * searches backwards instead, so Shift+letter steps to the previous match
 * (walking the same cycle in reverse).
 *
 * `labelOf` supplies the searchable text per option (the control may be generic
 * over its item shape); an empty string makes an option unmatchable. `onMatch`
 * receives the matched option and its index and decides what "active" means
 * (highlight, focus, or commit) — the type-ahead itself never commits.
 */
export function createTypeahead<T>(
  options: () => readonly T[],
  labelOf: (option: T) => string,
  onMatch: (option: T, index: number) => void,
  currentIndex: () => number,
): { handle(event: KeyboardEvent): boolean } {
  function handle(event: KeyboardEvent): boolean {
    // Only bare printable characters type ahead; Space activates the trigger,
    // modifier combos are shortcuts, and named keys drive the listbox. Shift is
    // not a shortcut here: it reverses the search direction.
    if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) {
      return false
    }
    const char = event.key.toLowerCase()
    const list = options()
    const count = list.length
    if (count === 0) {
      return true
    }
    const start = ((currentIndex() % count) + count) % count
    const direction = event.shiftKey ? -1 : 1
    for (let step = 1; step <= count; step++) {
      const index = (((start + direction * step) % count) + count) % count
      if (labelOf(list[index]).toLowerCase().startsWith(char)) {
        onMatch(list[index], index)
        break
      }
    }
    return true
  }

  return { handle }
}
