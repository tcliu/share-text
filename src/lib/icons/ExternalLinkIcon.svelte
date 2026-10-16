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
  <path d="M 13.03 0.91h 6.06v 6.06" />
  <path d="M 7.98 12.02L 19.09 0.91" />
  <path
    d="M 16.06 11.01v 6.06a 2.02 2.02 0 0 1 -2.02 2.02H 2.93a 2.02 2.02 0 0 1 -2.02 -2.02V 5.96a 2.02 2.02 0 0 1 2.02 -2.02h 6.06" />
</svg>
