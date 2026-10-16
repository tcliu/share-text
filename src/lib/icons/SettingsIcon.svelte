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
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  width={resolveIconPx(size)}
  height={resolveIconPx(size)}
  class={className}>
  <path
    d="M 10.2 0.83h -0.4a 1.83 1.83 0 0 0 -1.84 1.83v 0.17a 1.83 1.83 0 0 1 -0.91 1.58l -0.4 0.23a 1.83 1.83 0 0 1 -1.83 0l -0.14 -0.07a 1.83 1.83 0 0 0 -2.51 0.67l -0.2 0.35a 1.83 1.83 0 0 0 0.67 2.5l 0.14 0.09a 1.83 1.83 0 0 1 0.92 1.58v 0.47a 1.83 1.83 0 0 1 -0.92 1.6l -0.14 0.08a 1.83 1.83 0 0 0 -0.67 2.5l 0.2 0.35a 1.83 1.83 0 0 0 2.51 0.67l 0.14 -0.07a 1.83 1.83 0 0 1 1.83 0l 0.4 0.23a 1.83 1.83 0 0 1 0.91 1.58V 17.34a 1.83 1.83 0 0 0 1.84 1.83h 0.4a 1.83 1.83 0 0 0 1.84 -1.83v -0.17a 1.83 1.83 0 0 1 0.91 -1.58l 0.4 -0.23a 1.83 1.83 0 0 1 1.83 0l 0.14 0.07a 1.83 1.83 0 0 0 2.51 -0.67l 0.2 -0.36a 1.83 1.83 0 0 0 -0.67 -2.5l -0.14 -0.07a 1.83 1.83 0 0 1 -0.92 -1.6v -0.46a 1.83 1.83 0 0 1 0.92 -1.6l 0.14 -0.08a 1.83 1.83 0 0 0 0.67 -2.5l -0.2 -0.35a 1.83 1.83 0 0 0 -2.51 -0.67l -0.14 0.07a 1.83 1.83 0 0 1 -1.83 0l -0.4 -0.23a 1.83 1.83 0 0 1 -0.91 -1.58V 2.66a 1.83 1.83 0 0 0 -1.84 -1.83z" />
  <circle cx="10" cy="10" r="2.75" />
</svg>
