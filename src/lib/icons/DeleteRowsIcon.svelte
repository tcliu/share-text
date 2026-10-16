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
  stroke-width="2.35"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path d="M 1.18 4.12h 17.64" />
  <path d="M 7.06 4.12V 1.18h 5.88v 2.94" />
  <path d="M 4.12 4.12l 1.03 14.7h 9.7L 15.88 4.12" />
  <path d="M 8.53 8.53v 5.88M 11.47 8.53v 5.88" />
</svg>
