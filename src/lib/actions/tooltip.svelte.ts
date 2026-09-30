// Per-element `data-tip` tooltips as a Svelte action. The action reads its own
// element's `dataset.tip` (action input, never traversal) and publishes the
// box's text and position as reactive state. The route renders the shared box
// from that state, so nothing here writes to the DOM directly. Anchored to the
// hovered element instead of the cursor: centered under it, flipped above when
// there is no room below, and clamped inside the viewport.
import { flushSync } from 'svelte'
import type { Action } from 'svelte/action'

const MARGIN = 8
const GAP = 8

interface TipState {
  text: string
  left: number
  top: number
  maxWidth: number
  visible: boolean
}

/** Box content and geometry; rendered declaratively by the route. */
export const tipState = $state<TipState>({
  text: '',
  left: 0,
  top: 0,
  maxWidth: 320,
  visible: false,
})

let box: HTMLElement | null = null
let tipTarget: Element | null = null
let scrollUsers = 0

/** Register the shared tip box rendered by the route (null on teardown). */
export function setTipBox(el: HTMLElement | null): void {
  box = el
  if (!el) {
    tipTarget = null
    tipState.visible = false
  }
}

function hideTip(): void {
  tipState.visible = false
  tipTarget = null
}

function showTipFor(target: HTMLElement): void {
  const text = target.dataset.tip
  if (!box || !text || target === tipTarget) {
    return
  }
  tipTarget = target
  tipState.text = text
  // Keep the box inside the viewport horizontally before measuring it, so a
  // long tip on a narrow screen shrinks instead of clipping.
  tipState.maxWidth = Math.min(320, Math.max(0, window.innerWidth - MARGIN * 2))
  tipState.visible = true
  // Apply the text before measuring: a fixed box anchored at a previous
  // right-edge `left` would otherwise shrink-wrap to the remaining space and
  // measure too narrow, shifting the anchored position.
  tipState.left = 0
  tipState.top = 0
  flushSync()
  const rect = target.getBoundingClientRect()
  const width = box.offsetWidth
  const height = box.offsetHeight
  let x = rect.left + rect.width / 2 - width / 2
  const maxX = Math.max(MARGIN, window.innerWidth - MARGIN - width)
  x = Math.min(Math.max(x, MARGIN), maxX)
  let y = rect.bottom + GAP
  // A tip declaring `data-tip-place="above"` prefers above the anchor (used
  // where a below-placed tip would cover content); falls back below only
  // when there is no room above.
  if (target.dataset.tipPlace === 'above') {
    const above = rect.top - GAP - height
    y = above >= MARGIN ? above : rect.bottom + GAP
  } else if (y + height > window.innerHeight - MARGIN && rect.top > window.innerHeight - rect.bottom) {
    y = rect.top - GAP - height
  }
  const maxY = Math.max(MARGIN, window.innerHeight - MARGIN - height)
  y = Math.min(Math.max(y, MARGIN), maxY)
  tipState.left = x
  tipState.top = y
}

// One shared scroll listener no matter how many tips are mounted; a scroll
// hides the visible tip, and the element's own mousemove re-shows it.
function onScrollHide(): void {
  hideTip()
}

function ensureScrollListener(): void {
  if (scrollUsers++ === 0) {
    addEventListener('scroll', onScrollHide, true)
  }
}

function releaseScrollListener(): void {
  if (--scrollUsers === 0) {
    removeEventListener('scroll', onScrollHide, true)
  }
}

export const tooltip: Action<HTMLElement> = node => {
  const show = () => showTipFor(node)
  const hide = () => {
    if (tipTarget === node) {
      hideTip()
    }
  }
  const reshow = () => {
    if (!tipState.visible) {
      showTipFor(node)
    }
  }
  node.addEventListener('pointerenter', show)
  node.addEventListener('pointerleave', hide)
  node.addEventListener('pointermove', reshow)
  node.addEventListener('focus', show)
  node.addEventListener('blur', hide)
  ensureScrollListener()
  return {
    destroy() {
      node.removeEventListener('pointerenter', show)
      node.removeEventListener('pointerleave', hide)
      node.removeEventListener('pointermove', reshow)
      node.removeEventListener('focus', show)
      node.removeEventListener('blur', hide)
      releaseScrollListener()
      if (tipTarget === node) {
        hideTip()
      }
    },
  }
}
