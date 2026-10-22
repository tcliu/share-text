<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'
  import { DOUBLE_CHEVRON_STYLE, type DoubleChevronVariant } from './icon-variants'

  interface Props {
    className?: string
    size?: IconSizeInput
    variant?: DoubleChevronVariant
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // The double chevrons are the single chevron repeated along its axis, sharing
  // the set's lighter `regular` stroke and scaled as a pair so the ink fills the
  // box on the stacking axis; `variant` picks the treatment — regular by
  // default, bold a chunky flat-ended, sharp-apex pair whose inset artwork still
  // fits the box, heavy the full-extent pair whose two chevrons close up.

  let { className = '', size = 'md', variant = 'regular' }: Props = $props()

  const style = $derived(DOUBLE_CHEVRON_STYLE[variant])
</script>

<svg
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width={style.stroke}
  stroke-linecap={style.linecap}
  stroke-linejoin={style.linejoin}
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  {#if variant === 'regular'}
    <path d="M 8 3.4L 1.4 10L 8 16.6M 18.6 3.4L 12 10L 18.6 16.6" />
  {:else if variant === 'bold'}
    <path d="M 9.08 4.1L 3.18 10L 9.08 15.9M 18.38 4.1L 12.48 10L 18.38 15.9" />
  {:else}
    <path d="M 10 1.67L 2.59 10L 10 18.33M 17.41 1.67L 10 10L 17.41 18.33" />
  {/if}
</svg>
