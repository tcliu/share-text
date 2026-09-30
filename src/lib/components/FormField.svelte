<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    label: string
    htmlFor?: string
    className?: string
    /**
     * `stacked` (default) puts the label above the control. `inline` puts the
     * label in a 6rem column beside the control at >=sm and stacks below sm.
     */
    layout?: 'stacked' | 'inline'
    children?: Snippet
  }

  let { label, htmlFor, className = '', layout = 'stacked', children }: Props = $props()

  const wrapperClass = $derived(
    layout === 'inline'
      ? `grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[6rem_minmax(0,1fr)] ${className}`
      : `flex min-w-0 flex-col gap-1.5 ${className}`,
  )
</script>

<div class={wrapperClass}>
  <label for={htmlFor} class="w-fit cursor-pointer text-sm text-slate-300">{label}</label>
  {@render children?.()}
</div>
