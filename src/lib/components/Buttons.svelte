<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  type ButtonsAlign = 'left' | 'center' | 'right'

  interface Props {
    // Horizontal alignment for the default layout; a custom `className`
    // takes full control and ignores `align`.
    align?: ButtonsAlign
    // The row's scale: the gap between the buttons rides the shared size axis.
    // The buttons keep the size the caller gives them.
    size?: SizeInput
    className?: string
    children?: Snippet
  }

  const alignClasses: Record<ButtonsAlign, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }

  let { align = 'left', size = 'md', className, children }: Props = $props()

  // The gap is the row's only metric: a fixed ratio of the size dimension, so
  // `md` lands on the `gap-2` step (8px) and every step scales from there.
  const BUTTONS_RATIOS = { gap: 0.5 }

  const metrics = $derived(dimensionMetrics(size, BUTTONS_RATIOS))
  const rowStyle = $derived(sizeVarStyle('buttons', metrics))

  // `w-full` gives `justify-*` free space to work with: without it the row
  // hugs its content inside flex parents (e.g. the showcase demo row) and
  // `align` has no visible effect.
  const resolvedClassName = $derived(
    className ?? `flex w-full shrink-0 flex-wrap items-center gap-[var(--buttons-gap)] ${alignClasses[align]}`,
  )
</script>

<div class={resolvedClassName} style={rowStyle}>
  {@render children?.()}
</div>
