<script lang="ts">
  import { getI18nContext } from '$lib/i18n.svelte'
  import { createDragResize } from './use-resize-drag.svelte'
  const i18n = getI18nContext()

  interface Props {
    value: number
    min: number
    max: number
    onChange: (value: number) => void
    onDragEnd?: () => void
    ariaLabel?: string
    className?: string
    lineClass?: string
    unit?: 'px' | '%'
    orientation?: 'vertical' | 'horizontal'
    // A pane anchored on the far side of the handle (a right or bottom pane)
    // grows as the value falls, so the handle moves opposite the pointer;
    // setting this flips pointer, arrow-key, and Home/End deltas to keep it
    // under the cursor. Off for the default near-side (left/top) pane.
    invert?: boolean
  }

  let {
    value,
    min,
    max,
    onChange,
    onDragEnd,
    ariaLabel,
    className = '',
    lineClass = '',
    unit = 'px',
    orientation = 'vertical',
    invert: invertPane = false,
  }: Props = $props()

  const resolvedAriaLabel = $derived(ariaLabel ?? i18n.t('splitter.resize'))

  // Pixel-to-value basis and drag-start value, captured when a drag begins.
  let startValue = 0
  let containerSize = 0

  function clamp(next: number) {
    return Math.min(max, Math.max(min, next))
  }

  function toDelta(pointerDelta: number) {
    if (unit === '%') {
      return containerSize > 0 ? (pointerDelta / containerSize) * 100 : 0
    }
    return pointerDelta
  }

  // Getters keep the props live: the composable reads options per event, and a
  // vertical separator (default) moves horizontally.
  const drag = createDragResize({
    get horizontal() {
      return orientation === 'vertical'
    },
    get vertical() {
      return orientation === 'horizontal'
    },
    get step() {
      return unit === '%' ? 1 : 16
    },
    get invert() {
      return invertPane
    },
    toDelta,
    measure(handle) {
      startValue = value
      const parent = handle.parentElement
      containerSize = orientation === 'vertical' ? (parent?.clientWidth ?? 0) : (parent?.clientHeight ?? 0)
    },
    onMove(deltaX, deltaY, phase) {
      onChange(clamp((phase === 'drag' ? startValue : value) + deltaX + deltaY))
    },
    onJump(edge) {
      onChange(edge === 'min' ? min : max)
    },
    onEnd: () => onDragEnd?.(),
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="separator"
  aria-orientation={orientation}
  aria-label={resolvedAriaLabel}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  class={`relative shrink-0 touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${orientation === 'vertical' ? '-mx-1.5 w-3' : '-my-1.5 h-3'} ${drag.dragging ? (orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize') : 'cursor-default'} ${className}`}
  onpointerdown={drag.handlePointerDown}
  onpointermove={drag.handlePointerMove}
  onpointerup={drag.handlePointerUp}
  onpointercancel={drag.handlePointerCancel}
  onlostpointercapture={drag.handleLostPointerCapture}
  onkeydown={drag.handleKeydown}>
  {#if orientation === 'vertical'}
    <span class={`absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 cursor-col-resize ${lineClass}`}></span>
  {:else}
    <span class={`absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 cursor-row-resize ${lineClass}`}></span>
  {/if}
</div>
