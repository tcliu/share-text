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
    d="M 2.59 0.44a 1.49 1.49 0 0 0 -2.11 2.11L 7.89 9.96l -7.41 7.41a 1.49 1.49 0 1 0 2.11 2.12L 10 12.07l 7.41 7.42a 1.49 1.49 0 1 0 2.11 -2.12L 12.11 9.96l 7.41 -7.41a 1.49 1.49 0 0 0 -2.11 -2.11L 10 7.85L 2.59 0.44Z" />
</svg>
