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

<!-- Calendar page: the date-picker trigger glyph. -->
<svg
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width="2.1"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <rect x="1.36" y="3.52" width="17.28" height="15.43" rx="2.47" />
  <path d="M 1.36 8.46h 17.28" />
  <path d="M 6.3 1.05v 4.32M 13.7 1.05v 4.32" />
</svg>
