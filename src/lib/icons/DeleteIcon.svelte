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
    fill-rule="evenodd"
    d="M 8.28 0a 2.41 2.41 0 0 0 -2.31 1.7L 5.71 2.41H 2.41a 1.03 1.03 0 0 0 0 2.07h 0.61l 1.15 12.58A 3.1 3.1 0 0 0 7.26 20h 5.48a 3.1 3.1 0 0 0 3.09 -2.94l 1.15 -12.58h 0.61a 1.03 1.03 0 0 0 0 -2.07h -3.3l -0.26 -0.71a 2.41 2.41 0 0 0 -2.31 -1.7h -3.44Z"
    clip-rule="evenodd" />
</svg>
