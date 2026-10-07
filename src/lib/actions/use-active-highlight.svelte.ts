/**
 * Per-row highlight flags for an aria-activedescendant listbox. The flags are
 * updated incrementally so moving the highlight touches only the row leaving
 * and the row entering, instead of re-running every rendered row's class
 * effect. Keeps held-key navigation O(1) in the number of rendered rows.
 *
 * Call with accessors for the rendered row count and the highlighted index;
 * rows read `highlight.flags[index]`.
 */
export interface ActiveHighlight {
  readonly flags: boolean[]
}

export function useActiveHighlight(count: () => number, activeIndex: () => number): ActiveHighlight {
  let flags = $state<boolean[]>([])
  let lastActive = -1
  $effect(() => {
    const total = count()
    const active = activeIndex()
    if (flags.length !== total) {
      flags = new Array(total).fill(false)
      lastActive = -1
    }
    if (lastActive >= 0 && lastActive < flags.length && lastActive !== active) {
      flags[lastActive] = false
    }
    if (active >= 0 && active < flags.length) {
      flags[active] = true
    }
    lastActive = active
  })
  return {
    get flags() {
      return flags
    },
  }
}
