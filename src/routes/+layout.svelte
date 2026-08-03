<script lang="ts">
  import '../styles.css'
  import { Toaster } from 'svelte-sonner'

  let { children } = $props()
</script>

{@render children()}

<Toaster position="top-right" richColors closeButton />
