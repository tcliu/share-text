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
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <circle cx="10" cy="10" r="9.25" stroke="currentColor" stroke-width="1.5" fill="none" />
  <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none">
    <path d="M 1.3 10H 18.7M 2.3 5Q 10 7.5 17.7 5M 2.3 15Q 10 12.5 17.7 15" />
    <path d="M 10 0.75V 19.25M 10 0.75A 4.5 9.25 0 0 0 10 19.25A 4.5 9.25 0 0 0 10 0.75" />
  </g>
</svg>
