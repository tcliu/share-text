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
  fill="currentColor"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path
    d="M 16.64 0.89a 1.11 1.11 0 0 0 -2.18 0l -0.26 1.33a 1.11 1.11 0 0 1 -0.87 0.87l -1.33 0.26a 1.11 1.11 0 0 0 0 2.18l 1.33 0.27a 1.11 1.11 0 0 1 0.87 0.87l 0.26 1.32a 1.11 1.11 0 0 0 2.18 0l 0.27 -1.32a 1.11 1.11 0 0 1 0.87 -0.87l 1.32 -0.27a 1.11 1.11 0 0 0 0 -2.18l -1.32 -0.26a 1.11 1.11 0 0 1 -0.87 -0.87l -0.27 -1.33ZM 6.61 5.2a 1.11 1.11 0 0 0 -2.11 0l -0.76 2.28a 1.11 1.11 0 0 1 -0.7 0.7l -2.28 0.76a 1.11 1.11 0 0 0 0 2.11l 2.28 0.76a 1.11 1.11 0 0 1 0.7 0.7l 0.76 2.28a 1.11 1.11 0 0 0 2.11 0l 0.76 -2.28a 1.11 1.11 0 0 1 0.7 -0.7l 2.28 -0.76a 1.11 1.11 0 0 0 0 -2.11l -2.28 -0.76a 1.11 1.11 0 0 1 -0.7 -0.7L 6.61 5.2ZM 14.39 14.09a 1.11 1.11 0 0 0 -2.11 0l -0.21 0.61a 1.11 1.11 0 0 1 -0.7 0.71l -0.61 0.2a 1.11 1.11 0 0 0 0 2.11l 0.61 0.2a 1.11 1.11 0 0 1 0.7 0.7l 0.21 0.62a 1.11 1.11 0 0 0 2.11 0l 0.2 -0.62a 1.11 1.11 0 0 1 0.7 -0.7l 0.61 -0.2a 1.11 1.11 0 0 0 0 -2.11l -0.61 -0.21a 1.11 1.11 0 0 1 -0.7 -0.7l -0.2 -0.61Z" />
</svg>
