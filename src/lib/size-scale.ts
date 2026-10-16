// Canonical named-step scale shared by every sized component, so a numeric
// size means the same thing everywhere. Names are aliases for the shared
// dimension pixels; numbers are positions on that axis — scaled by a constant
// ratio from the dimension, never a second scale.

export type SizeName = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type SizeInput = SizeName | number

export const SIZE_PX: Record<SizeName, number> = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 }

// Step names in ascending pixel order, derived from the map so the order can
// never drift from the values.
export const SIZE_ORDER: SizeName[] = (Object.entries(SIZE_PX) as [SizeName, number][])
  .sort((a, b) => a[1] - b[1])
  .map(([step]) => step)

// Fixed font ratio: font size is always the size dimension times this.
export const FONT_RATIO = 0.875

// Fixed icon ratio: an icon renders at this fraction of its size — the same
// ratio the text-like controls give their font, so a glyph sits at its label's
// size. Glyphs fill their viewBox, so this is what holds a filled glyph at the
// optical size the component around it was tuned for (the artwork it replaced
// filled ~0.79 of its box); the control's own icon slot stays the size
// dimension.
export const ICON_RATIO = 0.8125

// Ratio-scaled font size for any input on the shared axis: names resolve to
// their step dimension, numbers pass through (minimum 1px), non-finite input
// falls back to the md step. Used by text-only components that scale
// continuously instead of stepping.
export function resolveFontPx(size: SizeInput): number {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return Math.max(1, size) * FONT_RATIO
  }
  const step = typeof size === 'string' ? size : 'md'
  return (SIZE_PX[step] ?? SIZE_PX.md) * FONT_RATIO
}
