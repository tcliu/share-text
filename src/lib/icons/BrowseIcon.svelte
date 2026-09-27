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
    d="M1.75 2h2.5c.414 0 .75.336.75.75v10.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.75-.75v-10.5C1 2.336 1.336 2 1.75 2Zm4.25 0h8.25c.414 0 .75.336.75.75v10.5a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75v-10.5C5.25 2.336 5.586 2 6 2Z" />
</svg>
