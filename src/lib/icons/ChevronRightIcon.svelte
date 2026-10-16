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
    d="M 4.77 19.64a 1.25 1.25 0 0 1 0 -1.77L 12.62 10.02L 4.77 2.16a 1.25 1.25 0 1 1 1.76 -1.76l 8.74 8.73a 1.25 1.25 0 0 1 0 1.77l -8.74 8.74a 1.25 1.25 0 0 1 -1.76 0Z"
    clip-rule="evenodd" />
</svg>
