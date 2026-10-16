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

<svg viewBox="0 0 20 20" aria-hidden="true" width={resolveIconPx(size)} height={resolveIconPx(size)} class={className}>
  <path d="M 5.66 8.37V 5.27a 4.34 4.34 0 0 1 8.68 0V 8.37" fill="none" stroke="currentColor" stroke-width="1.86" />
  <rect
    x="2.4"
    y="7.6"
    width="15.19"
    height="11.47"
    rx="2.33"
    fill="none"
    stroke="currentColor"
    stroke-width="1.86"
    stroke-linejoin="round" />
  <circle cx="10" cy="12.02" r="1.63" fill="currentColor" />
  <path d="M 10 12.25v 3.1" stroke="currentColor" stroke-width="1.32" stroke-linecap="round" />
</svg>
