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
    <path d="M 14.39 18.78L 5.61 10L 14.39 1.22" />
  {:else}
    <path d="M 11.59 1.59L 3.18 10L 11.59 18.41" />
  {/if}
</svg>
