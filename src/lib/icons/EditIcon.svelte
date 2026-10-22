<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'
  import { EDIT_STYLE, type EditVariant } from './icon-variants'

  interface Props {
    className?: string
    size?: IconSizeInput
    variant?: EditVariant
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // The edit pencil: `regular` is the outlined pencil with its rule, `solid`
  // the filled pencil, for an affordance that sits among filled marks.

  let { className = '', size = 'md', variant = 'regular' }: Props = $props()

  const style = $derived(EDIT_STYLE[variant])
</script>

<svg
  viewBox="0 0 20 20"
  fill={variant === 'solid' ? 'currentColor' : 'none'}
  stroke={variant === 'solid' ? 'none' : 'currentColor'}
  stroke-width={style.stroke}
  stroke-linecap={style.linecap}
  stroke-linejoin={style.linejoin}
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  {#if variant === 'regular'}
    <path d="M 10 18.65h 9.09" />
    <path d="M 14.55 1.98a 2.14 2.14 0 0 1 3.03 3.03L 4.95 17.64l -4.04 1.01l 1.01 -4.04L 14.55 1.98z" />
  {:else}
    <path
      d="m 1.55 15.41l -1.51 3.77a 0.6 0.6 0 0 0 0.78 0.78l 3.77 -1.51a 4.78 4.78 0 0 0 1.61 -1.06L 19.26 4.33a 2.54 2.54 0 0 0 -3.59 -3.59L 2.61 13.8a 4.78 4.78 0 0 0 -1.06 1.61Z" />
  {/if}
</svg>
