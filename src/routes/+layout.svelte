<script lang="ts">
  import type { Snippet } from 'svelte'
  import '../styles.css'
  import { Toaster, toast } from 'svelte-sonner'
  import type { LayoutData } from './$types'
  import { createShareTextI18n, setI18nContext } from '$lib/i18n.svelte'

  let { children, data }: { children: Snippet; data?: LayoutData } = $props()

  setI18nContext(createShareTextI18n())

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

{#if data?.devTag}
  <div
    class="fixed bottom-0 left-0 z-50 flex max-w-72 bg-lime-400 px-3 py-2 text-sm font-bold text-green-950"
    title={data.devTag}>
    <span class="min-w-0 truncate">{data.devTag}</span>
  </div>
{/if}

<Toaster position="top-right" richColors closeButton />
