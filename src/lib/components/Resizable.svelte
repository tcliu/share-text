<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import { createDragResize, type ResizeEdge } from './use-resize-drag.svelte'
  const i18n = getI18nContext()

  // A bound is a pixel number, or `'parent'` to mean "as large as the parent's
  // content box" — measured at interaction time and applied to the rendered box
  // too, so a bounded frame can never overflow its container.
  export type ResizeBound = number | 'parent'

  interface Props {
    width: number
    height: number
    minWidth?: number
    minHeight?: number
    maxWidth?: ResizeBound
    maxHeight?: ResizeBound
    onResize: (width: number, height: number) => void
    className?: string
    // Keep the handles out of the tab order: a frame that is page chrome shows
    // no focus stops and resizes by pointer only, while a frame whose keyboard
    // resize is the demo's own subject leaves this off, so its handles stay
    // immediately reachable.
    pointerOnlyHandles?: boolean
    children: Snippet
  }

  let {
    width,
    height,
    minWidth = 0,
    minHeight = 0,
    maxWidth = Number.POSITIVE_INFINITY,
    maxHeight = Number.POSITIVE_INFINITY,
    onResize,
    className = '',
    pointerOnlyHandles = false,
    children,
  }: Props = $props()

  const widthLabel = $derived(i18n.t('resizable.resizeWidth'))
  const heightLabel = $derived(i18n.t('resizable.resizeHeight'))
  const bothLabel = $derived(i18n.t('resizable.resizeBoth'))
  const valueText = $derived(i18n.t('resizable.resizeValue', { width, height }))

  // A `'parent'` bound has no fixed number to announce; the pixel bounds do.
  const maxWidthValue = $derived(typeof maxWidth === 'number' && Number.isFinite(maxWidth) ? maxWidth : undefined)
  const maxHeightValue = $derived(typeof maxHeight === 'number' && Number.isFinite(maxHeight) ? maxHeight : undefined)

  // Cap the rendered box at the parent's content box, so a frame whose requested
  // size exceeds the container never overflows it (and the container therefore
  // never needs a scrollbar that could cover the handles).
  const boundClass = $derived(
    `${maxWidth === 'parent' ? ' max-w-full' : ''}${maxHeight === 'parent' ? ' max-h-full' : ''}`,
  )

  // Arrow-key step in pixels, matching the Splitter's px step.
  const STEP = 16

  // Drag-start size plus the parent's content box, captured when an interaction
  // begins so a `'parent'` bound clamps against the current container size.
  let rootEl = $state<HTMLElement | null>(null)
  // A pointer-only frame keeps its handles out of the tab order, so a page whose
  // frame is chrome adds no invisible focus stops to its tab order.
  const handleTabIndex = $derived(pointerOnlyHandles ? -1 : 0)
  let startWidth = 0
  let startHeight = 0
  let availableWidth = Number.POSITIVE_INFINITY
  let availableHeight = Number.POSITIVE_INFINITY

  function captureBounds() {
    startWidth = width
    startHeight = height
    const parent = rootEl?.parentElement
    availableWidth =
      maxWidth === 'parent' ? (parent?.clientWidth ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
    availableHeight =
      maxHeight === 'parent' ? (parent?.clientHeight ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
  }

  // Drag deltas are fractional, so the clamped sizes round to the nearest
  // integer: the frame reports whole pixels on every move.
  function clampWidth(next: number) {
    const bound = typeof maxWidth === 'number' ? maxWidth : availableWidth
    return Math.round(Math.min(bound, Math.max(minWidth, next)))
  }

  function clampHeight(next: number) {
    const bound = typeof maxHeight === 'number' ? maxHeight : availableHeight
    return Math.round(Math.min(bound, Math.max(minHeight, next)))
  }

  // An unbounded edge has no maximum to jump to, so End keeps the size.
  function jumpWidth(edge: ResizeEdge) {
    if (edge === 'min') {
      return minWidth
    }
    return typeof maxWidth === 'number' && Number.isFinite(maxWidth) ? maxWidth : width
  }

  function jumpHeight(edge: ResizeEdge) {
    if (edge === 'min') {
      return minHeight
    }
    return typeof maxHeight === 'number' && Number.isFinite(maxHeight) ? maxHeight : height
  }

  // One drag handle per axis set: the right edge moves width, the bottom edge
  // height, and the corner both. An untouched axis passes through unclamped.
  function handle(horizontal: boolean, vertical: boolean) {
    return createDragResize({
      horizontal,
      vertical,
      step: STEP,
      toDelta: delta => delta,
      measure: captureBounds,
      onMove(deltaX, deltaY, phase) {
        const baseWidth = phase === 'drag' ? startWidth : width
        const baseHeight = phase === 'drag' ? startHeight : height
        onResize(
          horizontal ? clampWidth(baseWidth + deltaX) : width,
          vertical ? clampHeight(baseHeight + deltaY) : height,
        )
      },
      onJump(edge) {
        onResize(horizontal ? jumpWidth(edge) : width, vertical ? jumpHeight(edge) : height)
      },
    })
  }

  const widthDrag = handle(true, false)
  const heightDrag = handle(false, true)
  const bothDrag = handle(true, true)
</script>

<!-- A focusable `role="separator"` is a widget that carries a value, so the role
  plus `tabindex` is the complete ARIA pattern for a resize handle (the same
  pattern the app's pane `Splitter` uses). Svelte's a11y data misclassifies a
  focusable separator as non-interactive, so the two suppressions below are
  documented false positives, scoped to this element subtree — see AGENTS.md.
  The handles sit inside the container bounds: an ancestor with clipped overflow
  (a scrollport, an overflow-hidden panel) would cut off handles hanging past
  the edges, hiding them from view and hit-testing. They also carry `z-40` so a
  demo's own overlay (an app-shell backdrop, a drawer) cannot cover the frame
  handles and trap the pointer. A frame with `pointerOnlyHandles` keeps its
  stops closed for good, so page chrome adds no invisible focus stops; keyboard
  resizing stays on a frame that is the demo's own subject. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={rootEl}
  class={`relative ${className}${boundClass}`}
  style={`width:${width}px;height:${height}px`}>
  {@render children()}
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={widthLabel}
    aria-valuenow={width}
    aria-valuemin={minWidth}
    aria-valuemax={maxWidthValue}
    tabindex={handleTabIndex}
    class="absolute inset-y-0 right-0 z-40 w-3 cursor-e-resize touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    onpointerdown={widthDrag.handlePointerDown}
    onpointermove={widthDrag.handlePointerMove}
    onpointerup={widthDrag.handlePointerUp}
    onpointercancel={widthDrag.handlePointerCancel}
    onlostpointercapture={widthDrag.handleLostPointerCapture}
    onkeydown={event => {
      captureBounds()
      widthDrag.handleKeydown(event)
    }}>
  </div>
  <div
    role="separator"
    aria-orientation="horizontal"
    aria-label={heightLabel}
    aria-valuenow={height}
    aria-valuemin={minHeight}
    aria-valuemax={maxHeightValue}
    tabindex={handleTabIndex}
    class="absolute inset-x-0 bottom-0 z-40 h-3 cursor-s-resize touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    onpointerdown={heightDrag.handlePointerDown}
    onpointermove={heightDrag.handlePointerMove}
    onpointerup={heightDrag.handlePointerUp}
    onpointercancel={heightDrag.handlePointerCancel}
    onlostpointercapture={heightDrag.handleLostPointerCapture}
    onkeydown={event => {
      captureBounds()
      heightDrag.handleKeydown(event)
    }}>
  </div>
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={bothLabel}
    aria-valuenow={width}
    aria-valuemin={minWidth}
    aria-valuemax={maxWidthValue}
    aria-valuetext={valueText}
    tabindex={handleTabIndex}
    class="absolute right-0 bottom-0 z-40 h-4 w-4 cursor-nwse-resize touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    onpointerdown={bothDrag.handlePointerDown}
    onpointermove={bothDrag.handlePointerMove}
    onpointerup={bothDrag.handlePointerUp}
    onpointercancel={bothDrag.handlePointerCancel}
    onlostpointercapture={bothDrag.handleLostPointerCapture}
    onkeydown={event => {
      captureBounds()
      bothDrag.handleKeydown(event)
    }}>
  </div>
</div>
