<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    label: string
    htmlFor?: string
    className?: string
    children?: Snippet
  }

  let { label, htmlFor, className = '', children }: Props = $props()
</script>

<div class={className}>
  <label for={htmlFor} class="flex flex-col gap-1.5 text-sm text-slate-300">
    <span>{label}</span>
    {@render children?.()}
  </label>
</div>
