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
    d="M 10 0a 6.67 6.67 0 0 0 -4.24 11.81C 6.93 12.78 7.78 13.83 7.78 14.95v 0.72a 0.83 0.83 0 0 0 0.63 0.81a 6.68 6.68 0 0 0 3.18 0A 0.83 0.83 0 0 0 12.22 15.67v -0.72c 0 -1.12 0.85 -2.17 2.02 -3.14A 6.67 6.67 0 0 0 10 0ZM 8.74 18.24a 0.83 0.83 0 0 0 -0.25 1.65a 10.07 10.07 0 0 0 3.02 0a 0.83 0.83 0 0 0 -0.25 -1.65a 8.39 8.39 0 0 1 -2.52 0Z" />
</svg>
