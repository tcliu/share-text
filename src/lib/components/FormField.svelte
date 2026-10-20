<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  interface Props {
    label: string
    htmlFor?: string
    className?: string
    /**
     * `stacked` (default) puts the label above the control. `inline` puts the
     * label in a size-scaled column beside the control at >=sm and stacks below
     * sm.
     */
    layout?: 'stacked' | 'inline'
    size?: SizeInput
    children?: Snippet
  }

  let { label, htmlFor, className = '', layout = 'stacked', size = 'md', children }: Props = $props()

  // Fixed ratios of the size dimension, calibrated so `md` reproduces the
  // original field: a 14px label, a 6px stack gap, an 8px inline gap, and the
  // 96px inline label column.
  const FORM_FIELD_RATIOS = { font: 0.875, gap: 0.375, inlineGap: 0.5, inlineCol: 6 }

  const metrics = $derived(dimensionMetrics(size, FORM_FIELD_RATIOS))
  const fieldStyle = $derived(sizeVarStyle('ff', metrics))

  const wrapperClass = $derived(
    layout === 'inline'
      ? `grid min-w-0 grid-cols-1 items-center gap-[var(--ff-inline-gap)] sm:grid-cols-[var(--ff-inline-col)_minmax(0,1fr)] ${className}`
      : `flex min-w-0 flex-col gap-[var(--ff-gap)] ${className}`,
  )
</script>

<div class={wrapperClass} style={fieldStyle}>
  <label for={htmlFor} class="w-fit cursor-pointer text-[length:var(--ff-font)] text-slate-300">{label}</label>
  {@render children?.()}
</div>
