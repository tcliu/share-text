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
  <path d="M 10 12.65a 2.65 2.65 0 1 0 0 -5.3a 2.65 2.65 0 0 0 0 5.3Z" />
  <path
    fill-rule="evenodd"
    d="M 0.12 10.62a 1.75 1.75 0 0 1 0 -1.25A 10.59 10.59 0 0 1 10 2.59c 4.51 0 8.36 2.82 9.88 6.78c 0.16 0.41 0.16 0.86 0 1.26A 10.59 10.59 0 0 1 10 17.41c -4.51 0 -8.36 -2.82 -9.88 -6.79ZM 14.23 10a 4.23 4.23 0 1 1 -8.46 0a 4.23 4.23 0 0 1 8.46 0Z"
    clip-rule="evenodd" />
</svg>
