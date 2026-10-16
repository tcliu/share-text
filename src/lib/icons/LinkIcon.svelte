<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'

  interface Props {
    className?: string
    size?: IconSizeInput
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.

  let { className = '', size = 'md' }: Props = $props()
</script>

<svg
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width="1.83"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path d="M 8.17 10.91a 4.57 4.57 0 0 0 6.89 0.5l 2.74 -2.74a 4.57 4.57 0 0 0 -6.46 -6.46l -1.57 1.56" />
  <path d="M 11.83 9.09a 4.57 4.57 0 0 0 -6.89 -0.5l -2.74 2.74a 4.57 4.57 0 0 0 6.46 6.46l 1.56 -1.56" />
</svg>
