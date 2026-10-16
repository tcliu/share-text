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
    d="M 10 0a 0.94 0.94 0 0 1 0.94 0.94v 1.87a 0.94 0.94 0 0 1 -1.88 0v -1.87A 0.94 0.94 0 0 1 10 0ZM 10 16.25a 0.94 0.94 0 0 1 0.94 0.94v 1.87a 0.94 0.94 0 0 1 -1.88 0v -1.87A 0.94 0.94 0 0 1 10 16.25ZM 10 6.25a 3.75 3.75 0 1 0 0 7.5a 3.75 3.75 0 0 0 0 -7.5ZM 17.07 4.26a 0.94 0.94 0 1 0 -1.32 -1.33l -1.33 1.33a 0.94 0.94 0 0 0 1.33 1.32l 1.32 -1.32ZM 5.58 15.75a 0.94 0.94 0 1 0 -1.32 -1.33l -1.33 1.33a 0.94 0.94 0 0 0 1.33 1.32l 1.32 -1.32ZM 20 10a 0.94 0.94 0 0 1 -0.94 0.94h -1.87a 0.94 0.94 0 0 1 0 -1.88h 1.87A 0.94 0.94 0 0 1 20 10ZM 3.75 10a 0.94 0.94 0 0 1 -0.94 0.94h -1.87a 0.94 0.94 0 0 1 0 -1.88h 1.87A 0.94 0.94 0 0 1 3.75 10ZM 15.75 17.07a 0.94 0.94 0 0 0 1.32 -1.32l -1.32 -1.33a 0.94 0.94 0 1 0 -1.33 1.33l 1.33 1.32ZM 4.26 5.58a 0.94 0.94 0 0 0 1.32 -1.32l -1.32 -1.33a 0.94 0.94 0 1 0 -1.33 1.33l 1.32 1.32Z" />
</svg>
