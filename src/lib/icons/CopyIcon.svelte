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
  stroke-width="2.43"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <rect x="5.27" y="5.27" width="13.51" height="13.51" rx="2.03" />
  <path
    d="M 13.38 5.27V 2.57a 1.35 1.35 0 0 0 -1.35 -1.35H 2.57a 1.35 1.35 0 0 0 -1.35 1.35v 9.46a 1.35 1.35 0 0 0 1.35 1.35h 2.7" />
</svg>
