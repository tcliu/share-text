<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'

  interface Props {
    className?: string
    size?: IconSizeInput
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // One of the set's filled direction markers: the viewBox is cropped tight to
  // the 3:2 triangle, so `size` is the width and the height is two-thirds of it
  // — a square render would letterbox the glyph back and gap a stacked pair
  // without negative margins.

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
