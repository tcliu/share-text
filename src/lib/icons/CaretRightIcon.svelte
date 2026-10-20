<script lang="ts">
  import { resolveIconPx, type IconSizeInput } from './icon-size'

  interface Props {
    className?: string
    size?: IconSizeInput
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  // One of the set's filled direction markers: the viewBox is cropped tight to
  // the 3:2 triangle, so `size` is the height and the width is two-thirds of it
  // — the same arrow as the up/down pair, rotated a quarter turn.

  let { className = '', size = 'md' }: Props = $props()
</script>

<svg
  viewBox="8 4 8 12"
  fill="currentColor"
  aria-hidden="true"
  width={(resolveIconPx(size) * 8) / 12}
  height={resolveIconPx(size)}
  class={className}>
  <path d="M16 10 8 16V4l8 6Z" />
</svg>
