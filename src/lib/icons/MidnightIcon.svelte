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
    d="M 11.04 1.02a 1.2 1.2 0 0 0 -2.08 0l -2.19 5.27l -5.69 0.46a 1.2 1.2 0 0 0 -0.64 2.12l 4.33 3.71l -1.32 5.55a 1.2 1.2 0 0 0 1.76 1.29L 10 16.23l 4.78 3.19a 1.2 1.2 0 0 0 1.77 -1.29l -1.32 -5.55l 4.33 -3.71a 1.2 1.2 0 0 0 -0.64 -2.12l -5.69 -0.46l -2.19 -5.27Z" />
</svg>
