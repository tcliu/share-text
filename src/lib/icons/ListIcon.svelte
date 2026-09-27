<script lang="ts">
  type IconSize = 'xs' | 'sm' | 'md' | 'lg'

  interface Props {
    className?: string
    size?: IconSize
  }

  // Width/height attributes (not classes) so `size` composes with `className`:
  // explicit size classes in className still win, since CSS beats attributes.
  const SIZE_PX: Record<IconSize, number> = { xs: 12, sm: 16, md: 20, lg: 24 }

  let { className = '', size = 'md' }: Props = $props()
</script>

<svg
  viewBox="0 0 16 16"
  fill="currentColor"
  aria-hidden="true"
  width={SIZE_PX[size]}
  height={SIZE_PX[size]}
  class={className}>
  <path
    d="M2 3.75A.75.75 0 0 1 2.75 3h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 2 3.75Zm3.75 0A.75.75 0 0 1 6.5 3h6.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Zm-3.75 4A.75.75 0 0 1 2.75 7h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 2 7.75Zm3.75 0A.75.75 0 0 1 6.5 7h6.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Zm-3.75 4A.75.75 0 0 1 2.75 11h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 2 11.75Zm3.75 0A.75.75 0 0 1 6.5 11h6.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Z" />
</svg>
