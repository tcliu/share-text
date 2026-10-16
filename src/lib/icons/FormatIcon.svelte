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
    d="M 0 2.86a 1.43 1.43 0 0 1 1.43 -1.43h 17.14a 1.43 1.43 0 1 1 0 2.86H 1.43a 1.43 1.43 0 0 1 -1.43 -1.43Zm 0 7.14a 1.43 1.43 0 0 1 1.43 -1.43h 11.43a 1.43 1.43 0 1 1 0 2.86H 1.43a 1.43 1.43 0 0 1 -1.43 -1.43Zm 0 7.14a 1.43 1.43 0 0 1 1.43 -1.43h 7.14a 1.43 1.43 0 1 1 0 2.86H 1.43a 1.43 1.43 0 0 1 -1.43 -1.43Z"
    clip-rule="evenodd" />
</svg>
