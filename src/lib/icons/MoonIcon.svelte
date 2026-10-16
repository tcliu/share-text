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
    d="M 6.51 0.56a 0.89 0.89 0 0 1 0.31 0.92a 8.35 8.35 0 0 0 11.88 9.5a 0.89 0.89 0 0 1 1.27 1.02A 10.14 10.14 0 1 1 5.54 0.46a 0.89 0.89 0 0 1 0.97 0.1Z" />
</svg>
