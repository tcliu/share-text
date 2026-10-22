<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'
  import { COPY_STYLE, type CopyVariant } from './icon-variants'

  interface Props {
    className?: string
    size?: IconSizeInput
    variant?: CopyVariant
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // Two overlapping squares: `regular` is the set's large pair, `compact` the
  // tighter pair an adjacent copy action needs to stay distinguishable from.

  let { className = '', size = 'md', variant = 'regular' }: Props = $props()

  const style = $derived(COPY_STYLE[variant])
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
    <rect x="5.27" y="5.27" width="13.51" height="13.51" rx="2.03" />
    <path
      d="M 13.38 5.27V 2.57a 1.35 1.35 0 0 0 -1.35 -1.35H 2.57a 1.35 1.35 0 0 0 -1.35 1.35v 9.46a 1.35 1.35 0 0 0 1.35 1.35h 2.7" />
  {:else}
    <rect x="2.26" y="1.07" width="11.91" height="11.91" rx="1.79" />
    <path
      d="M 14.17 5.83h 2.38a 1.19 1.19 0 0 1 1.19 1.19v 10.72a 1.19 1.19 0 0 1 -1.19 1.19H 5.83a 1.19 1.19 0 0 1 -1.19 -1.19v -2.38" />
  {/if}
</svg>
