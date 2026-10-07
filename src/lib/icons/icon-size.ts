// Shared icon sizing: names are aliases for pixel sizes, and numbers pass
// through so callers can scale an icon continuously (e.g. a dropdown chevron
// tracking an interpolated control size). Width/height stay attributes, never
// classes, so `size` composes with `className`. The scale itself lives in
// `$lib/size-scale` alongside every other sized component.
import { SIZE_PX, type SizeInput } from '$lib/size-scale'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg'

export type IconSizeInput = SizeInput

export function resolveIconPx(size: IconSizeInput): number {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return Math.max(1, size)
  }
  return SIZE_PX[typeof size === 'string' ? size : 'md']
}
