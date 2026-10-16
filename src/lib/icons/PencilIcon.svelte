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
    d="m 1.55 15.41l -1.51 3.77a 0.6 0.6 0 0 0 0.78 0.78l 3.77 -1.51a 4.78 4.78 0 0 0 1.61 -1.06L 19.26 4.33a 2.54 2.54 0 0 0 -3.59 -3.59L 2.61 13.8a 4.78 4.78 0 0 0 -1.06 1.61Z" />
</svg>
