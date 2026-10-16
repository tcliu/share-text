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
  fill="currentColor"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path
    d="M 0 2.2a 1.3 1.3 0 0 1 1.3 -1.3h 9.1a 1.3 1.3 0 1 1 0 2.6H 2.6v 13h 7.8a 1.3 1.3 0 1 1 0 2.6H 1.3a 1.3 1.3 0 0 1 -1.3 -1.3V 2.2Zm 15.21 5.59a 1.3 1.3 0 0 1 1.82 0l 2.6 2.6a 1.3 1.3 0 0 1 0 1.82l -2.6 2.6a 1.3 1.3 0 1 1 -1.82 -1.82l 0.39 -0.39H 10.4a 1.3 1.3 0 1 1 0 -2.6h 5.33l -0.52 -0.39a 1.3 1.3 0 0 1 0 -1.82Z" />
</svg>
