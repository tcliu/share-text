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
  <rect x="2.26" y="1.07" width="11.91" height="11.91" rx="1.79" />
  <path
    d="M 14.17 5.83h 2.38a 1.19 1.19 0 0 1 1.19 1.19v 10.72a 1.19 1.19 0 0 1 -1.19 1.19H 5.83a 1.19 1.19 0 0 1 -1.19 -1.19v -2.38" />
</svg>
