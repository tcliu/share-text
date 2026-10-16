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
    d="M 0.2 12.65A 1.22 1.22 0 0 1 1.43 11.84h 2.45a 1.22 1.22 0 0 1 1.22 1.22v 5.72a 1.22 1.22 0 0 1 -1.22 1.22h -2.45A 1.22 1.22 0 0 1 0.2 18.78v -5.72Zm 7.35 -6.53A 1.22 1.22 0 0 1 8.78 5.31h 2.44a 1.22 1.22 0 0 1 1.23 1.22v 12.25a 1.22 1.22 0 0 1 -1.23 1.22h -2.44a 1.22 1.22 0 0 1 -1.23 -1.22v -12.25Zm 7.35 -4.9a 1.22 1.22 0 0 1 1.22 -1.22h 2.45a 1.22 1.22 0 0 1 1.23 1.22v 17.15a 1.22 1.22 0 0 1 -1.23 1.22h -2.45a 1.22 1.22 0 0 1 -1.22 -1.22V 1.22Z" />
</svg>
