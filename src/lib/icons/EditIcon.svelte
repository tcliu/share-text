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
  fill="none"
  stroke="currentColor"
  stroke-width="1.82"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path d="M 10 18.65h 9.09" />
  <path d="M 14.55 1.98a 2.14 2.14 0 0 1 3.03 3.03L 4.95 17.64l -4.04 1.01l 1.01 -4.04L 14.55 1.98z" />
</svg>
