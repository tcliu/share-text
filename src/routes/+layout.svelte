<script lang="ts">
  import '../styles.css'
  import { Toaster, toast } from 'svelte-sonner'

  let { children } = $props()

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

<Toaster position="top-right" richColors closeButton />
