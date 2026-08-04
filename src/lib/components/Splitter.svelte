<script lang="ts">
  interface Props {
    value: number
    min: number
    max: number
    onChange: (value: number) => void
    onDragEnd?: () => void
    ariaLabel?: string
    className?: string
  }

  let { value, min, max, onChange, onDragEnd, ariaLabel = 'Resize split panes', className = '' }: Props = $props()

  let handleRef = $state<HTMLElement | null>(null)
  let dragging = $state(false)
  let startX = 0
  let startValue = 0

  function clampWidth(next: number) {
    return Math.min(max, Math.max(min, next))
  }

  function handlePointerDown(event: PointerEvent) {
    dragging = true
    startX = event.clientX
    startValue = value
    handleRef?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragging) return
    onChange(clampWidth(startValue + event.clientX - startX))
  }

  function handlePointerUp(event: PointerEvent) {
    if (!dragging) return
    dragging = false
    if (handleRef?.hasPointerCapture(event.pointerId)) {
      handleRef.releasePointerCapture(event.pointerId)
    }
    onDragEnd?.()
  }

  function handlePointerCancel() {
    if (!dragging) return
    dragging = false
    onDragEnd?.()
  }

  function handleKeydown(event: KeyboardEvent) {
    let delta = 0
    if (event.key === 'ArrowLeft') {
      delta = -16
    } else if (event.key === 'ArrowRight') {
      delta = 16
    } else if (event.key === 'Home') {
      onChange(min)
      onDragEnd?.()
      return
    } else if (event.key === 'End') {
      onChange(max)
      onDragEnd?.()
      return
    } else {
      return
    }
    event.preventDefault()
    onChange(clampWidth(value + delta))
    onDragEnd?.()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={handleRef}
  role="separator"
  aria-orientation="vertical"
  aria-label={ariaLabel}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  class={`relative -mx-1.5 w-3 shrink-0 touch-none select-none outline-none ${dragging ? 'cursor-col-resize' : 'cursor-default'} ${className}`}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  onkeydown={handleKeydown}>
  <span class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 cursor-col-resize"></span>
</div>
