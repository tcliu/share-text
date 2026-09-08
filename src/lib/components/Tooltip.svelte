<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
    align?: 'center' | 'left' | 'right'
    class?: string
    trigger?: HTMLElement | null
  }

  let { children, align = 'center', class: extraClass = '', trigger = null }: Props = $props()

  let anchor = $state<HTMLElement | null>(null)
  let tooltipEl = $state<HTMLElement | null>(null)
  let visible = $state(false)
  let top = $state(0)
  let left = $state(0)

  const VIEWPORT_MARGIN = 8
  const PLACEMENT_GAP = 8

  function currentTrigger(): HTMLElement | null {
    return trigger ?? anchor?.parentElement ?? null
  }

  function place() {
    const current = currentTrigger()
    if (!current) {
      return
    }
    const rect = current.getBoundingClientRect()
    // Size is unknown on the very first pass; the follow-up placement corrects
    // both axes once rendered dimensions are measurable.
    const measured = tooltipEl?.isConnected ? tooltipEl : null
    const width = measured ? measured.offsetWidth : 0
    const height = measured ? measured.offsetHeight : 0

    // Open below by default; flip above when there is no room below and the
    // space above is larger (mirrors the positionPanel auto-placement rule).
    let targetTop = rect.bottom + PLACEMENT_GAP
    if (
      height > 0 &&
      targetTop + height > window.innerHeight - VIEWPORT_MARGIN &&
      rect.top > window.innerHeight - rect.bottom
    ) {
      targetTop = rect.top - PLACEMENT_GAP - height
    }
    if (height > 0) {
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - height)
      targetTop = Math.min(Math.max(targetTop, VIEWPORT_MARGIN), maxTop)
    }
    top = Math.round(targetTop)

    // Alignment shifts are folded into the left offset instead of CSS
    // transforms so the box can be clamped to the viewport horizontally.
    const start =
      align === 'left'
        ? rect.left
        : align === 'right'
          ? rect.right - width
          : rect.left + rect.width / 2 - width / 2
    const min = VIEWPORT_MARGIN
    const max = window.innerWidth - VIEWPORT_MARGIN - width
    left = Math.round(Math.min(Math.max(start, min), Math.max(min, max)))
  }

  // Re-place once the tooltip is rendered and measured so first-paint
  // positioning (unknown width) gets corrected.
  $effect(() => {
    if (!visible || !tooltipEl) {
      return
    }
    place()
    const raf = requestAnimationFrame(() => place())
    return () => cancelAnimationFrame(raf)
  })

  function show() {
    hideQueued = false
    place()
    visible = true
  }

  function hide() {
    clearDismissTimer()
    if (!visible) {
      return
    }
    hideQueued = true
    queueMicrotask(() => {
      if (hideQueued) {
        hideQueued = false
        visible = false
      }
    })
  }

  const supportsHover = $derived(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover)').matches,
  )

  const LONG_PRESS_MS = 500
  const TOOLTIP_LINGER_MS = 2000
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  let hideQueued = false

  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function clearDismissTimer() {
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
  }

  $effect(() => {
    const current = currentTrigger()
    if (!current || !supportsHover) {
      return
    }
    const enter = () => show()
    const leave = () => hide()
    current.addEventListener('mouseenter', enter)
    current.addEventListener('mouseleave', leave)
    current.addEventListener('focusin', enter)
    current.addEventListener('focusout', leave)
    return () => {
      current.removeEventListener('mouseenter', enter)
      current.removeEventListener('mouseleave', leave)
      current.removeEventListener('focusin', enter)
      current.removeEventListener('focusout', leave)
    }
  })

  $effect(() => {
    const current = currentTrigger()
    if (!current) {
      return
    }
    const startPress = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        return
      }
      clearPressTimer()
      if (visible) {
        clearDismissTimer()
        dismissTimer = setTimeout(() => {
          dismissTimer = null
          hide()
        }, TOOLTIP_LINGER_MS)
        return
      }
      pressTimer = setTimeout(() => {
        pressTimer = null
        show()
        dismissTimer = setTimeout(() => {
          dismissTimer = null
          hide()
        }, TOOLTIP_LINGER_MS)
      }, LONG_PRESS_MS)
    }
    const cancelPress = () => clearPressTimer()
    current.addEventListener('pointerdown', startPress)
    current.addEventListener('pointerup', cancelPress)
    current.addEventListener('pointercancel', cancelPress)
    current.addEventListener('pointerleave', cancelPress)
    return () => {
      current.removeEventListener('pointerdown', startPress)
      current.removeEventListener('pointerup', cancelPress)
      current.removeEventListener('pointercancel', cancelPress)
      current.removeEventListener('pointerleave', cancelPress)
      clearPressTimer()
      clearDismissTimer()
    }
  })

  $effect(() => {
    if (!visible) {
      return
    }
    const current = currentTrigger()
    const reposition = () => place()
    const hideWhenAway = (event: PointerEvent) => {
      if (!current || (event.target instanceof Node && current.contains(event.target))) {
        return
      }
      hide()
    }
    const hideOnBlur = () => hide()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('pointermove', hideWhenAway, true)
    window.addEventListener('pointerdown', hideWhenAway, true)
    window.addEventListener('blur', hideOnBlur)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('pointermove', hideWhenAway, true)
      window.removeEventListener('pointerdown', hideWhenAway, true)
      window.removeEventListener('blur', hideOnBlur)
    }
  })

  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }
</script>

<span bind:this={anchor} class="hidden"></span>

{#if visible}
  <span
    bind:this={tooltipEl}
    use:portal
    role="tooltip"
    class={`st-tooltip ${extraClass}`}
    style={`top:${top}px; left:${left}px; opacity:1;`}>
    {@render children()}
  </span>
{/if}
