<script module lang="ts">
  import type { Snippet } from 'svelte'

  export interface KebabMenuItem {
    id: string
    label: string
    onClick: () => void
    disabled?: boolean
    icon?: Snippet
  }
</script>

<script lang="ts">
  import { positionPanel } from '$lib/position-panel.svelte'

  interface Props {
    items: KebabMenuItem[]
    ariaLabel?: string
    align?: 'left' | 'right'
    autoPlace?: boolean
  }

  let { items, ariaLabel = 'More actions', align = 'right', autoPlace = true }: Props = $props()

  const id = Math.random().toString(36).slice(2)
  const menuId = `kebab-menu-${id}`

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)

  function close() {
    open = false
  }

  function toggle() {
    open = !open
  }

  function run(item: KebabMenuItem) {
    if (item.disabled) return
    close()
    item.onClick()
  }

  $effect(() => {
    if (!open) return
    function handleKeydownCapture(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        event.preventDefault()
        close()
      }
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef && !containerRef.contains(target) && panelRef && !panelRef.contains(target)) {
        close()
      }
    }
    window.addEventListener('keydown', handleKeydownCapture, true)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeydownCapture, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  })
</script>

<div class="relative inline-flex" bind:this={containerRef} data-escape-capture={open ? '' : null}>
  <button
    type="button"
    aria-label={ariaLabel}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? menuId : undefined}
    onclick={toggle}
    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300">
    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  </button>
  {#if open}
    <div
      bind:this={panelRef}
      id={menuId}
      role="menu"
      aria-label={ariaLabel}
      use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
      class="fixed left-0 top-0 z-50 will-change-transform w-44 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur">
      {#each items as item (item.id)}
        <button
          type="button"
          role="menuitem"
          onclick={() => run(item)}
          disabled={item.disabled}
          class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
            item.disabled
              ? 'cursor-not-allowed text-slate-600'
              : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}>
          {#if item.icon}
            <span class="h-4 w-4 shrink-0 [&_svg]:h-full [&_svg]:w-full">{@render item.icon()}</span>
          {/if}
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
