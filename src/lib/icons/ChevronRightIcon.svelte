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
    <path d="M 5.61 1.22L 14.39 10L 5.61 18.78" />
  {:else}
    <path d="M 8.41 1.59L 16.82 10L 8.41 18.41" />
  {/if}
</svg>
