<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    className?: string
    children?: Snippet
  }

  let { className = 'flex flex-wrap items-center justify-end gap-3', children }: Props = $props()
</script>

<div class={className}>
  {@render children?.()}
</div>
