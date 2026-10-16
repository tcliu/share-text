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
  stroke-width="2.14"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <circle cx="10" cy="10" r="8.93" />
  <path d="M 7.32 7.32a 2.98 2.98 0 1 1 3.93 2.62c -0.86 0.36 -1.55 1.19 -1.55 2.26V 12.38" />
  <path d="M 10 15.48h 0.01" />
</svg>
