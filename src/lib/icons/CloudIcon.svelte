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
    d="M 0 12.78A 5 5 0 0 0 5 17.78H 15.55a 4.44 4.44 0 0 0 2.08 -8.38a 3.89 3.89 0 0 0 -5.01 -4.74A 5 5 0 0 0 3.4 8.04A 5 5 0 0 0 0 12.78Z" />
</svg>
