// Shared icon sizing: names are aliases for the size dimension and numbers
// scale continuously (e.g. a dropdown chevron tracking an interpolated control
// size), then every icon renders at the shared icon ratio of that size — a
// glyph fills its viewBox, so the ratio is what holds it at the optical size
// the component around it was tuned for. Width/height stay attributes, never
// classes, so `size` composes with `className`. The scales themselves live in
// `$lib/size-scale` alongside every other sized component.
import { ICON_RATIO, SIZE_PX, type SizeInput } from '$lib/size-scale'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type IconSizeInput = SizeInput

export function resolveIconPx(size: IconSizeInput): number {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return Math.max(1, size) * ICON_RATIO
  }
  return SIZE_PX[typeof size === 'string' ? size : 'md'] * ICON_RATIO
}
