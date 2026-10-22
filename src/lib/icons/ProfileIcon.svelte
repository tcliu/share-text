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

<!-- Head and shoulders: the head reaches the top edge and the shoulders the
     bottom one, so the glyph fills the grid on two edges instead of floating
     inside it. -->
<svg
  viewBox="0 0 20 20"
  fill="currentColor"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path
    fill-rule="evenodd"
    d="M 10 0a 4.44 4.44 0 1 0 0 8.89a 4.44 4.44 0 0 0 0 -8.89ZM 0.37 18.89a 9.63 9.63 0 0 1 19.26 0a 1.11 1.11 0 0 1 -1.11 1.11h -17.04a 1.11 1.11 0 0 1 -1.11 -1.11Z"
    clip-rule="evenodd" />
</svg>
