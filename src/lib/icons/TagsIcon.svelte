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
  fill="none"
  stroke="currentColor"
  stroke-width="2.43"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path
    d="M 10.82 1.22H 4.6a 2.7 2.7 0 0 0 -2.7 2.7v 6.22a 2.7 2.7 0 0 0 0.8 1.9l 5.94 5.95a 2.7 2.7 0 0 0 3.83 0l 4.84 -4.84a 2.7 2.7 0 0 0 0 -3.82L 12.7 2.03A 2.7 2.7 0 0 0 10.82 1.22Z" />
  <circle cx="6.29" cy="6.96" r="1.69" />
</svg>
