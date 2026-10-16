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
    d="M 8.05 1.93V 7.73a 3.75 3.75 0 0 0 -1.01 2.42L 2 15.19a 2.5 2.5 0 0 0 1.68 3.84A 23.1 23.1 0 0 0 9.92 20c 2.32 0 4.61 -0.32 6.81 -0.97a 2.5 2.5 0 0 0 1.42 -3.46L 13.12 10.15A 3.75 3.75 0 0 0 11.79 7.73V 1.93A 14.36 14.36 0 0 0 8.05 1.93ZM 9.92 0.02c -0.96 0 -1.92 0.02 -2.86 0.09a 0.94 0.94 0 0 0 0.36 1.83c 0.93 -0.05 1.85 -0.07 2.85 -0.07h 0.5c 0.65 0 1.29 0.02 1.92 0.06a 0.94 0.94 0 0 0 0.1 -1.87A 29.35 29.35 0 0 0 9.92 0.02Z" />
</svg>
