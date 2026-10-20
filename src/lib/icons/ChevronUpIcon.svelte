<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'
  import { CHEVRON_STYLE, type ChevronVariant } from './chevron-stroke'

  interface Props {
    className?: string
    size?: IconSizeInput
    variant?: ChevronVariant
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // The four chevrons are one glyph rotated and share the set's lighter
  // `regular` stroke; `variant` picks the treatment — regular by default, bold a
  // chunky flat-ended, sharp-apex mark whose inset artwork still fits the box.

  let { className = '', size = 'md', variant = 'regular' }: Props = $props()

  const style = $derived(CHEVRON_STYLE[variant])
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
    <path d="M 1.22 14.39L 10 5.61L 18.78 14.39" />
  {:else}
    <path d="M 1.59 11.59L 10 3.18L 18.41 11.59" />
  {/if}
</svg>
