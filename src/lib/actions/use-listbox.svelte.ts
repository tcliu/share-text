import { flushSync } from 'svelte'
import { createFocusoutClose } from './use-focusout-close'
import { useDropdown } from './use-dropdown.svelte'
import { revealInScrollport, useListSelection, type ListSelection } from './use-list-selection.svelte'
import { useActiveHighlight, type ActiveHighlight } from './use-active-highlight.svelte'
import { createTypeahead } from './typeahead'

/**
 * Headless navigation and dismissal core shared by the listbox dropdowns
 * (`SelectDropdown`, `ChipDropdown`, `TagInput`) and `Menu`. It owns the active
 * index, the held-key moves (with optional disabled-item skipping), native
 * type-ahead, the focusout close, and the `useDropdown` open/close lifecycle.
 *
 * The caller keeps its own `open` state, filtering, and value commit, because
 * those differ per surface (a select commits and closes; a tag input adds and
 * keeps the panel open). It also chooses how the active row is reflected:
 * `SelectDropdown`/`ChipDropdown`/`TagInput` render `highlight.flags` over
 * never-focused rows (aria-activedescendant), while `Menu` passes
 * `onActiveChange` to focus the item and turns `revealOnActive` off.
 *
 * The config stays a flat list of single-purpose accessors on purpose: each is
 * a one-line closure, and grouping them into sub-objects would not reduce the
 * caller's decisions (see `~/.agents/references/js-ts.md`, Module design).
 */
export interface UseListboxConfig<T> {
  /** Reactive accessor for the caller-owned open state. */
  isOpen: () => boolean
  /** Close the caller-owned panel. Used as the default dismissal handler. */
  onClose: () => void
  /** Open the caller-owned panel. Used by type-ahead when it fires while closed. */
  openPanel: () => void
  /** Visible options, already filtered by the caller. */
  options: () => readonly T[]
  /** Type-ahead label per option; an empty string makes it unmatchable. */
  optionLabel?: (option: T) => string
  /** Skip disabled rows during movement, first/last, and type-ahead. */
  isDisabled?: (index: number) => boolean
  /** Reflect a new active index (e.g. focus a menu item). Omit to render
   *  `highlight.flags` over never-focused rows instead. */
  onActiveChange?: (index: number) => void
  /** Scroll the active row into view. Default true; a focus-based surface turns
   *  it off because focusing the row already reveals it. */
  revealOnActive?: boolean
  getContainer: () => HTMLElement | null
  /** Element for outside-click inclusion (the portalled overlay in a sheet). */
  getPanel: () => HTMLElement | null
  /** Element for focusout containment; defaults to `getPanel` (they differ in a
   *  phone sheet, where the focus trap lives in the dialog, not the overlay). */
  getFocusOutPanel?: () => HTMLElement | null
  /** Element ref by index, for scrollport reveal (registered, never queried). */
  getOptionEl: (index: number) => HTMLElement | null | undefined
  /** Opt into native type-ahead (button triggers, not text inputs). */
  typeahead?: boolean
  onEscape?: (event: KeyboardEvent) => boolean | void
  onOutsideClick?: () => void
  onScrollClose?: () => void
}

export interface Listbox<T> {
  readonly selection: ListSelection
  readonly highlight: ActiveHighlight
  revealActive(): void
  /** Set the active row (no flush), reflect it, and reveal it. */
  setActive(index: number): void
  /** Move the active row by one (wrapping, skipping disabled) or to an end. */
  moveHighlight(direction: 'up' | 'down' | 'first' | 'last'): void
  firstEnabled(): number
  lastEnabled(): number
  handleTypeahead(event: KeyboardEvent): boolean
  handleFocusOut(event: FocusEvent): void
}

export function useListbox<T>(config: UseListboxConfig<T>): Listbox<T> {
  const selection = useListSelection()
  // Per-row highlight flags (shared helper): moving the highlight touches only
  // the row leaving and the row entering, so held-key navigation is O(1).
  const highlight = useActiveHighlight(
    () => config.options().length,
    () => selection.index,
  )

  function isDisabled(index: number): boolean {
    return config.isDisabled?.(index) ?? false
  }

  // Keep the highlighted option visible while arrowing through a scrollable
  // panel: the option never receives focus (aria-activedescendant pattern), so
  // the browser would otherwise let it drift out of the scrollport.
  function revealActive(): void {
    if (config.revealOnActive === false) return
    revealInScrollport(config.getOptionEl(selection.peek()))
  }

  function reflectActive(index: number): void {
    selection.set(index)
    config.onActiveChange?.(index)
    revealActive()
  }

  function firstEnabled(): number {
    const list = config.options()
    for (let i = 0; i < list.length; i++) {
      if (!isDisabled(i)) return i
    }
    return -1
  }

  function lastEnabled(): number {
    const list = config.options()
    for (let i = list.length - 1; i >= 0; i--) {
      if (!isDisabled(i)) return i
    }
    return -1
  }

  function setActive(index: number): void {
    if (index < 0) return
    reflectActive(index)
  }

  // OS key auto-repeat fires back-to-back keydowns; flush synchronously so each
  // repeat paints (or focuses) the newly active row immediately.
  function moveHighlight(direction: 'up' | 'down' | 'first' | 'last'): void {
    const count = config.options().length
    if (count === 0) return
    let next: number
    if (direction === 'first') {
      next = firstEnabled()
    } else if (direction === 'last') {
      next = lastEnabled()
    } else {
      const delta = direction === 'down' ? 1 : -1
      let idx = selection.peek()
      next = -1
      for (let step = 0; step < count; step++) {
        idx = (idx + delta + count) % count
        if (!isDisabled(idx)) {
          next = idx
          break
        }
      }
    }
    if (next < 0) return
    flushSync(() => reflectActive(next))
  }

  // Native-select type-ahead for the non-filterable trigger: typing moves the
  // active item (opening the panel to show it) without confirming the value.
  const typeahead = config.typeahead
    ? createTypeahead(
        () => config.options(),
        option => config.optionLabel?.(option) ?? '',
        (_option, index) => {
          if (!config.isOpen()) {
            flushSync(() => config.openPanel())
          }
          flushSync(() => reflectActive(index))
        },
        () => selection.peek(),
      )
    : null

  function handleTypeahead(event: KeyboardEvent): boolean {
    return typeahead ? typeahead.handle(event) : false
  }

  const handleFocusOut = createFocusoutClose(
    () => config.isOpen(),
    () => ({ container: config.getContainer(), panel: config.getFocusOutPanel?.() ?? config.getPanel() }),
    () => config.onClose(),
  )

  useDropdown(() => ({
    isOpen: () => config.isOpen(),
    container: () => config.getContainer(),
    onOutsideClick: () => (config.onOutsideClick ?? config.onClose)(),
    onEscape: (event) => (config.onEscape ? config.onEscape(event) : config.onClose()),
    onScrollClose: config.onScrollClose,
    panel: () => config.getPanel(),
  }))

  return {
    selection,
    highlight,
    revealActive,
    setActive,
    moveHighlight,
    firstEnabled,
    lastEnabled,
    handleTypeahead,
    handleFocusOut,
  }
}
