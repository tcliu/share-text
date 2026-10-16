<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'

  interface Props {
    className?: string
    size?: IconSizeInput
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // The viewBox is cropped tight to the arrow (12x8, a 3:2 glyph), so the
  // height is two-thirds the width: a square render would letterbox this glyph
  // back and gap the stacked sort pair without negative margins.

  let { className = '', size = 'md' }: Props = $props()
</script>

<svg
  viewBox="4 8 12 8"
  fill="currentColor"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={(resolveIconPx(size) * 8) / 12}
  class={className}>
  <path d="M10 16 4 8h12l-6 8Z" />
</svg>
