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
    d="M 0 3.21A 1.07 1.07 0 0 1 1.07 2.14h 17.86a 1.07 1.07 0 0 1 0 2.15H 1.07A 1.07 1.07 0 0 1 0 3.21Zm 0 6.79a 1.07 1.07 0 0 1 1.07 -1.07h 17.86a 1.07 1.07 0 0 1 0 2.14H 1.07A 1.07 1.07 0 0 1 0 10Zm 0 6.79a 1.07 1.07 0 0 1 1.07 -1.08h 17.86a 1.07 1.07 0 0 1 0 2.15H 1.07a 1.07 1.07 0 0 1 -1.07 -1.07Z"
    clip-rule="evenodd" />
</svg>
