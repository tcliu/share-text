// Shared drag-resize behavior for the resize handles: one pointer-captured
// handle plus arrow-key and Home/End nudges. The composable owns the
// pointer-capture lifecycle and the key-to-delta mapping; each consumer owns its
// value model (Splitter: one value with px/% units; Resizable: width + height)
// and clamps in its own units.
//
// `invert` covers a pane anchored on the far side of the handle (a right or
// bottom pane): the value falls as the pointer advances, so both the pointer and
// key deltas flip and Home/End swap sides.

export type ResizeMovePhase = 'drag' | 'key'
export type ResizeEdge = 'min' | 'max'

export interface DragResizeOptions {
  /** The handle responds to horizontal pointer movement and Left/Right keys. */
  horizontal: boolean
  /** The handle responds to vertical pointer movement and Up/Down keys. */
  vertical: boolean
  /** Convert a pointer delta in pixels into the value's own units. */
  toDelta: (pointerDelta: number) => number
  /** Deliver a value-space delta; `phase` separates a live drag from a key nudge. */
  onMove: (deltaX: number, deltaY: number, phase: ResizeMovePhase) => void
  /** Home/End: move the handle's axes to their lower or upper bound. */
  onJump: (edge: ResizeEdge) => void
  /** Fired when a drag or a key nudge completes. */
  onEnd?: () => void
  /** Arrow-key step in value units; defaults to 16. */
  step?: number
  /** Flip pointer and key deltas, and swap Home/End, for a far-side pane. */
  invert?: boolean
  /** Capture drag-start state and the pixel-to-value basis before a drag begins. */
  measure?: (handle: HTMLElement) => void
}

export interface DragResize {
  /** True while a pointer drag is in flight; drives the active cursor. */
  readonly dragging: boolean
  handlePointerDown: (event: PointerEvent & { currentTarget: HTMLElement }) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent & { currentTarget: HTMLElement }) => void
  handlePointerCancel: () => void
  handleLostPointerCapture: () => void
  handleKeydown: (event: KeyboardEvent) => void
}

export function createDragResize(options: DragResizeOptions): DragResize {
  // Options are read per event, not captured, so a changed prop (unit, invert,
  // orientation) takes effect on the next interaction.
  let dragging = $state(false)
  let startX = 0
  let startY = 0

  const sign = () => (options.invert ? -1 : 1)

  function finish() {
    if (!dragging) return
    dragging = false
    options.onEnd?.()
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: HTMLElement }) {
    options.measure?.(event.currentTarget)
    dragging = true
    startX = event.clientX
    startY = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragging) return
    const deltaX = options.horizontal ? options.toDelta(event.clientX - startX) : 0
    const deltaY = options.vertical ? options.toDelta(event.clientY - startY) : 0
    const direction = sign()
    // `+ 0` normalises a negated zero so consumers never receive `-0`.
    options.onMove(direction * deltaX + 0, direction * deltaY + 0, 'drag')
  }

  function handlePointerUp(event: PointerEvent & { currentTarget: HTMLElement }) {
    if (!dragging) return
    dragging = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    options.onEnd?.()
  }

  // Capture can be lost abnormally (element removal), which no pointerup
  // delivers; stop the drag so a later button-less move cannot resize.
  function handleLostPointerCapture() {
    finish()
  }

  function handleKeydown(event: KeyboardEvent) {
    const step = options.step ?? 16
    const direction = sign()
    if (event.key === 'ArrowLeft' && options.horizontal) {
      event.preventDefault()
      options.onMove(-direction * step, 0, 'key')
    } else if (event.key === 'ArrowRight' && options.horizontal) {
      event.preventDefault()
      options.onMove(direction * step, 0, 'key')
    } else if (event.key === 'ArrowUp' && options.vertical) {
      event.preventDefault()
      options.onMove(0, -direction * step, 'key')
    } else if (event.key === 'ArrowDown' && options.vertical) {
      event.preventDefault()
      options.onMove(0, direction * step, 'key')
    } else if (event.key === 'Home') {
      event.preventDefault()
      options.onJump(options.invert ? 'max' : 'min')
    } else if (event.key === 'End') {
      event.preventDefault()
      options.onJump(options.invert ? 'min' : 'max')
    } else {
      return
    }
    // Every handled key completes an adjustment, so a caller persists a
    // keyboard resize exactly as it persists a drag.
    options.onEnd?.()
  }

  return {
    get dragging() {
      return dragging
    },
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel: finish,
    handleLostPointerCapture,
    handleKeydown,
  }
}
