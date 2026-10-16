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
  <path
    d="M 6.97 10h 6.06M 6.97 14.04h 6.06M 15.05 19.09H 4.95a 2.02 2.02 0 0 1 -2.02 -2.02V 2.93a 2.02 2.02 0 0 1 2.02 -2.02h 7.07l 5.05 5.05v 11.11a 2.02 2.02 0 0 1 -2.02 2.02Z" />
  <path d="M 12.02 0.91v 4.04a 1.01 1.01 0 0 0 1.01 1.01h 4.04" />
</svg>
