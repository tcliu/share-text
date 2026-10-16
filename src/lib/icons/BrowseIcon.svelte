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
    d="M 1.07 1.43h 3.57c 0.59 0 1.07 0.48 1.07 1.07v 15a 1.07 1.07 0 0 1 -1.07 1.07h -3.57a 1.07 1.07 0 0 1 -1.07 -1.07v -15C 0 1.91 0.48 1.43 1.07 1.43Zm 6.07 0h 11.79c 0.59 0 1.07 0.48 1.07 1.07v 15a 1.07 1.07 0 0 1 -1.07 1.07H 7.14a 1.07 1.07 0 0 1 -1.07 -1.07v -15C 6.07 1.91 6.55 1.43 7.14 1.43Z" />
</svg>
