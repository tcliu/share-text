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
    clip-rule="evenodd"
    d="M 1.88 0C 0.84 0 0 0.84 0 1.88V 16.25C 0 18.32 1.68 20 3.75 20C 5.82 20 7.5 18.32 7.5 16.25V 1.88C 7.5 0.84 6.66 0 5.63 0H 1.88ZM 16.57 8.74L 9.38 15.93V 5.32L 11.26 3.43C 12 2.7 13.18 2.7 13.91 3.43L 16.57 6.09C 17.3 6.82 17.3 8 16.57 8.74ZM 7.95 20H 18.13C 19.16 20 20 19.16 20 18.13V 14.38C 20 13.34 19.16 12.5 18.13 12.5H 15.46L 7.95 20ZM 3.75 17.5C 4.44 17.5 5 16.94 5 16.25C 5 15.56 4.44 15 3.75 15C 3.06 15 2.5 15.56 2.5 16.25C 2.5 16.94 3.06 17.5 3.75 17.5Z" />
</svg>
