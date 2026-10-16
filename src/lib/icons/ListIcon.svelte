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
    d="M 0 3.33A 1.25 1.25 0 0 1 1.25 2.08h 2.5a 1.25 1.25 0 0 1 0 2.5h -2.5A 1.25 1.25 0 0 1 0 3.33Zm 6.25 0A 1.25 1.25 0 0 1 7.5 2.08h 11.25a 1.25 1.25 0 0 1 0 2.5H 7.5a 1.25 1.25 0 0 1 -1.25 -1.25Zm -6.25 6.67A 1.25 1.25 0 0 1 1.25 8.75h 2.5a 1.25 1.25 0 0 1 0 2.5h -2.5A 1.25 1.25 0 0 1 0 10Zm 6.25 0A 1.25 1.25 0 0 1 7.5 8.75h 11.25a 1.25 1.25 0 0 1 0 2.5H 7.5a 1.25 1.25 0 0 1 -1.25 -1.25Zm -6.25 6.67A 1.25 1.25 0 0 1 1.25 15.42h 2.5a 1.25 1.25 0 0 1 0 2.5h -2.5A 1.25 1.25 0 0 1 0 16.67Zm 6.25 0A 1.25 1.25 0 0 1 7.5 15.42h 11.25a 1.25 1.25 0 0 1 0 2.5H 7.5a 1.25 1.25 0 0 1 -1.25 -1.25Z" />
</svg>
