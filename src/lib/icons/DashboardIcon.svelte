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
    d="M2 9.5A.75.75 0 0 1 2.75 9h1.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-1.5A.75.75 0 0 1 2 13.25v-3.5Zm4.5-4A.75.75 0 0 1 7.25 5h1.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-7.5Zm4.5-3a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V2.5Z" />
</svg>
