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
    d="M 16.8 11.82a 7.03 7.03 0 0 1 -11.77 3.15l -0.4 -0.39h 3.11a 0.96 0.96 0 0 0 0 -1.92H 2.32a 0.96 0.96 0 0 0 -0.96 0.96v 5.42a 0.96 0.96 0 0 0 1.92 0v -3.11l 0.39 0.4a 8.95 8.95 0 0 0 14.98 -4.01a 0.96 0.96 0 0 0 -1.85 -0.5Zm 1.57 -4.76a 0.96 0.96 0 0 0 0.28 -0.68V 0.96a 0.96 0.96 0 0 0 -1.92 0V 4.07l -0.4 -0.4A 8.95 8.95 0 0 0 1.36 7.68a 0.96 0.96 0 1 0 1.85 0.5A 7.03 7.03 0 0 1 14.98 5.03l 0.4 0.39h -3.11a 0.96 0.96 0 0 0 0 1.92h 5.42a 0.96 0.96 0 0 0 0.68 -0.28Z"
    clip-rule="evenodd" />
</svg>
