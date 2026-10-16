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
    d="M 10 5a 2.5 2.5 0 1 1 0 -5a 2.5 2.5 0 0 1 0 5Zm 0 7.5a 2.5 2.5 0 1 1 0 -5a 2.5 2.5 0 0 1 0 5Zm 0 7.5a 2.5 2.5 0 1 1 0 -5a 2.5 2.5 0 0 1 0 5Z" />
</svg>
