// The hidden-state class applied to icon buttons that reveal on hover. It is
// gated behind the `(hover: hover)` media query so touch devices always show
// the control; a bare `opacity-0` here would make it unreachable on touch.
// Built from fragments so this file never contains the candidate utility as
// contiguous text: Tailwind scans test sources and would otherwise generate
// the class from this constant, masking a regression in the components.
export const GATED_HIDDEN_CLASS = '[' + '@media(hover:hover)]:opacity-0'

// Locate the span that reveals an icon button on hover: the closest ancestor
// of the button carrying the (hover: hover)-gated hidden class. In `Button`
// the reveal span wraps a `span.group.relative.inline-flex` which wraps the
// `<button>`, so the wrapper is found by walking up the ancestor chain.
export function findRevealWrapper(el: Element): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    if (node.classList.contains(GATED_HIDDEN_CLASS)) {
      return node
    }
    node = node.parentElement
  }
  return null
}
