// The chevron family's stroke treatment. `regular` is the set's lighter weight
// drawn with round caps and joins, matching the other line icons; `bold` is a
// chunkier weight whose flat ends and sharp apex come from butt caps and miter
// joins (the chunky reference look). Each glyph draws the matching artwork — the
// bold path is inset so the heavier stroke still fills the box without clipping
// — and lists its paths in `CHEVRON_VARIANTS` order, which the icon viewport
// spec pairs with these styles. All of it lives here so the eight chevron glyphs
// and the spec share one source.
export type ChevronVariant = 'regular' | 'bold'

export const CHEVRON_VARIANTS: readonly ChevronVariant[] = ['regular', 'bold']

export interface ChevronStrokeStyle {
  stroke: number
  linecap: 'butt' | 'round'
  linejoin: 'miter' | 'round'
}

export const CHEVRON_STYLE: Record<ChevronVariant, ChevronStrokeStyle> = {
  regular: { stroke: 2.43, linecap: 'round', linejoin: 'round' },
  bold: { stroke: 4.5, linecap: 'butt', linejoin: 'miter' },
}
