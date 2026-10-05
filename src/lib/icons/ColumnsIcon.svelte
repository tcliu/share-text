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
    d="M2 3.75A.75.75 0 0 1 2.75 3h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 2 3.75Zm0 4A.75.75 0 0 1 2.75 7h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 2 7.75Zm0 4A.75.75 0 0 1 2.75 11h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 2 11.75Zm6-8A.75.75 0 0 1 8.75 3h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 8 3.75Zm0 4A.75.75 0 0 1 8.75 7h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 8 7.75Zm0 4A.75.75 0 0 1 8.75 11h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 8 11.75Z" />
</svg>
