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
  stroke-width="1.82"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <circle cx="15.45" cy="3.64" r="2.73" />
  <circle cx="4.55" cy="10" r="2.73" />
  <circle cx="15.45" cy="16.36" r="2.73" />
  <line x1="6.9" y1="11.37" x2="13.11" y2="14.99" />
  <line x1="13.1" y1="5.01" x2="6.9" y2="8.63" />
</svg>
