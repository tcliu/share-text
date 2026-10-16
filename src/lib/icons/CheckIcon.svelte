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
    d="M 19.58 1.64a 1.07 1.07 0 0 1 0.2 1.5l -11.44 15.02a 1.07 1.07 0 0 1 -1.62 0.11l -6.43 -6.44a 1.07 1.07 0 0 1 1.51 -1.52l 5.57 5.57l 10.7 -14.04a 1.07 1.07 0 0 1 1.51 -0.2Z"
    clip-rule="evenodd" />
</svg>
