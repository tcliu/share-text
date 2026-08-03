<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
    align?: 'center' | 'left' | 'right'
    class?: string
  }

  let { children, align = 'center', class: extraClass = '' }: Props = $props()

  let anchor = $state<HTMLElement | null>(null)
  let visible = $state(false)
  let top = $state(0)
  let left = $state(0)

  const transformClass = $derived(
    align === 'left' ? 'translate-x-0' : align === 'right' ? '-translate-x-full' : '-translate-x-1/2',
  )

  function place() {
    const trigger = anchor?.parentElement
    if (!trigger) {
      return
    }
    const rect = trigger.getBoundingClientRect()
    top = Math.round(rect.bottom + 8)
    left = Math.round(align === 'left' ? rect.left : align === 'right' ? rect.right : rect.left + rect.width / 2)
  }

  function show() {
    place()
    visible = true
  }

  function hide() {
    visible = false
  }

  $effect(() => {
    const trigger = anchor?.parentElement
    if (!trigger) {
      return
    }
    const enter = () => show()
    const leave = () => hide()
    trigger.addEventListener('mouseenter', enter)
    trigger.addEventListener('mouseleave', leave)
    trigger.addEventListener('focusin', enter)
    trigger.addEventListener('focusout', leave)
    return () => {
      trigger.removeEventListener('mouseenter', enter)
      trigger.removeEventListener('mouseleave', leave)
      trigger.removeEventListener('focusin', enter)
      trigger.removeEventListener('focusout', leave)
    }
  })

  $effect(() => {
    if (!visible) {
      return
    }
    const reposition = () => place()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
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
    use:portal
    role="tooltip"
    class={`st-tooltip ${transformClass} ${extraClass}`}
    style={`top:${top}px; left:${left}px; opacity:1;`}>
    {@render children()}
  </span>
{/if}
