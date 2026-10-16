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
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M 14.3 3.96a 8.59 8.59 0 1 1 -11.06 2.14c 0.25 -0.32 0.73 -0.27 0.98 0.04c 0.34 0.44 0.72 0.83 1.15 1.18c 0.41 0.33 0.97 -0.06 0.95 -0.59a 7.34 7.34 0 0 1 0.7 -3.39a 7.4 7.4 0 0 1 3.06 -3.27c 0.3 -0.17 0.67 -0.02 0.83 0.29A 8.55 8.55 0 0 0 14.3 3.96ZM 14.91 12.63a 4.91 4.91 0 0 1 -4.91 4.92c -2.35 0 -4.32 -1.72 -4.8 -3.91c -0.11 -0.53 0.54 -0.79 1 -0.51a 4.96 4.96 0 0 0 1.97 0.69c 0.37 0.05 0.65 -0.29 0.62 -0.66a 7.34 7.34 0 0 1 1.62 -5.15a 0.55 0.55 0 0 1 0.53 -0.2A 4.91 4.91 0 0 1 14.91 12.63Z" />
</svg>
