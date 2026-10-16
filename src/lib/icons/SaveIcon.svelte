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
    d="M 2.35 0h 10.59l 5.88 5.88v 12.94a 1.18 1.18 0 0 1 -1.17 1.18H 2.35a 1.18 1.18 0 0 1 -1.17 -1.18V 1.18a 1.18 1.18 0 0 1 1.17 -1.18Zm 0 2.35v 15.3h 14.12V 6.71L 12.12 2.35H 2.35Zm 2.36 2.36v 3.53h 7.06V 2.35H 4.71v 2.36Zm 1.17 8.23h 7.06v 1.18H 5.88v -1.18Z" />
</svg>
