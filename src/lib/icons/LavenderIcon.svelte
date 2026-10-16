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
    d="M 10.93 19.48a 0.71 0.71 0 0 0 0.99 0l 0.01 0c 0.03 -0.02 1.64 -1.14 3.47 -2.83C 17.6 14.6 20 11.18 20 7.46C 20 3.42 17.13 0.32 13.57 0.32c -1.51 0 -2.88 0.78 -3.71 2A 4.57 4.57 0 0 0 6.43 0.32C 2.87 0.32 0 3.42 0 7.46c 0 3.72 2.4 7.14 4.6 9.19c 1.83 1.68 3.44 2.81 3.47 2.83l 0 0Z" />
</svg>
