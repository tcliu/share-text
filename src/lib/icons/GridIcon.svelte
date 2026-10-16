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
    d="M 1.07 0.71h 6.43c 0.59 0 1.07 0.48 1.07 1.08v 6.42a 1.07 1.07 0 0 1 -1.07 1.08h -6.43A 1.07 1.07 0 0 1 0 8.21v -6.42C 0 1.19 0.48 0.71 1.07 0.71Zm 0 10h 6.43c 0.59 0 1.07 0.48 1.07 1.08v 6.42a 1.07 1.07 0 0 1 -1.07 1.08h -6.43A 1.07 1.07 0 0 1 0 18.21v -6.42C 0 11.19 0.48 10.71 1.07 10.71Zm 11.43 -10h 6.43c 0.59 0 1.07 0.48 1.07 1.08v 6.42a 1.07 1.07 0 0 1 -1.07 1.08h -6.43A 1.07 1.07 0 0 1 11.43 8.21v -6.42c 0 -0.6 0.48 -1.08 1.07 -1.08Zm 0 10h 6.43c 0.59 0 1.07 0.48 1.07 1.08v 6.42a 1.07 1.07 0 0 1 -1.07 1.08h -6.43a 1.07 1.07 0 0 1 -1.07 -1.08v -6.42c 0 -0.6 0.48 -1.08 1.07 -1.08Z" />
</svg>
