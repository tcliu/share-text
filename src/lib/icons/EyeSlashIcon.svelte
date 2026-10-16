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
    d="M 2.04 1.61a 0.89 0.89 0 0 0 -1.25 1.26l 2.18 2.18A 10.63 10.63 0 0 0 0.06 10.46a 1.18 1.18 0 0 0 0 0.72a 9.49 9.49 0 0 0 14.81 4.92l 3.09 3.08a 0.89 0.89 0 1 0 1.25 -1.25l -17.17 -17.17Zm 9.04 9.03a 3.26 3.26 0 0 1 -4.45 -4.45l 4.45 4.45Zm 2.52 2.52A 7.72 7.72 0 0 1 1.83 10.82a 8.87 8.87 0 0 1 2.42 -3.79l 1.22 1.22a 5.03 5.03 0 0 0 7.11 7.11l 1.02 1.02Zm 2.15 -2.15l -1.22 -1.22a 5.03 5.03 0 0 0 -7.05 -7.06l -1.22 -1.21A 9.49 9.49 0 0 1 19.95 10.46a 1.18 1.18 0 0 1 0 0.72a 9.39 9.39 0 0 1 -4.2 4.56Z" />
</svg>
