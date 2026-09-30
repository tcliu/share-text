<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import type { LayoutData } from './$types'
  import '../styles.css'
  import { Toaster, toast } from 'svelte-sonner'
  import { createAppI18n, setI18nContext } from '$lib/i18n.svelte'
  import { setTipBox, tipState } from '$lib/actions/tooltip.svelte'
  import { useTheme } from '$lib/use-theme.svelte'

  let { children, data }: { children: Snippet; data?: LayoutData } = $props()

  setI18nContext(createAppI18n())
  const themeState = useTheme()

  // Register the shared tooltip box (the host half of `use:tooltip`).
  let tipBoxEl = $state<HTMLElement | null>(null)
  $effect(() => {
    setTipBox(tipBoxEl)
    return () => setTipBox(null)
  })

  onMount(() => {
    themeState.hydrate()
  })

  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const activeToasts = toast.getActiveToasts()
      const topmost = activeToasts[0]
      if (topmost) {
        event.preventDefault()
        toast.dismiss(topmost.id)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })
</script>

{@render children()}

<div
  id="tip"
  role="tooltip"
  bind:this={tipBoxEl}
  class="fixed z-tooltip pointer-events-none rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs leading-normal text-slate-200 whitespace-pre-line shadow-lg"
  style:left="{tipState.left}px"
  style:top="{tipState.top}px"
  style:max-width="{tipState.maxWidth}px"
  hidden={!tipState.visible}>{tipState.text}</div>

{#if data?.devTag}
  <div
    class="fixed bottom-0 left-0 z-50 flex max-w-72 bg-lime-400 px-3 py-2 text-sm font-bold text-green-950"
    title={data.devTag}>
    <span class="min-w-0 truncate">{data.devTag}</span>
  </div>
{/if}

<Toaster position="top-right" richColors closeButton />
