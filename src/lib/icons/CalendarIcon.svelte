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
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
  <path d="M3 8.5h14" />
  <path d="M7 2.5v3.5M13 2.5v3.5" />
</svg>
