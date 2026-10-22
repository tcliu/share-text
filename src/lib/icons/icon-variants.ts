// The variant registry: which glyphs carry more than one rendering of the same
// mark, and the stroke treatment each rendering uses. A glyph whose concept
// already exists in the set at a different weight or treatment takes the
// existing name and selects its rendering here, rather than shipping a second
// icon for the same concept.
//
// The chevron family's own weight ladder lives in `chevron-stroke.ts`; the
// double chevrons carry a third, fuller rendering, and the copy and edit
// marks carry their own. The icon viewport spec reads this registry, so each
// rendering's geometry is validated against its own stroke treatment instead
// of against the union of the glyph's renderings.
import { CHEVRON_STYLE, CHEVRON_VARIANTS, type ChevronStrokeStyle } from './chevron-stroke'

export interface IconVariantLadder {
  /** The variant names, in the order the glyph authors its renderings. */
  variants: readonly string[]
  /** The stroke treatment for each rendering, parallel to `variants`. */
  styles: readonly ChevronStrokeStyle[]
}

// The double chevrons: the same repeated-chevron mark at three weights. The
// `heavy` rendering is the full-extent, gapless mark — the heavier, chunkier
// treatment a collapse affordance wants, where the two chevrons close up.
export const DOUBLE_CHEVRON_VARIANTS = ['regular', 'bold', 'heavy'] as const
export type DoubleChevronVariant = (typeof DOUBLE_CHEVRON_VARIANTS)[number]
export const DOUBLE_CHEVRON_STYLE: Record<(typeof DOUBLE_CHEVRON_VARIANTS)[number], ChevronStrokeStyle> = {
  regular: { stroke: 2.43, linecap: 'round', linejoin: 'round' },
  bold: { stroke: 4.5, linecap: 'butt', linejoin: 'miter' },
  heavy: { stroke: 3.33, linecap: 'round', linejoin: 'round' },
}

// The copy mark: `regular` is the set's large overlapping pair, `compact` the
// tighter pair a second, adjacent copy action needs to stay distinguishable.
export const COPY_VARIANTS = ['regular', 'compact'] as const
export type CopyVariant = (typeof COPY_VARIANTS)[number]
export const COPY_STYLE: Record<(typeof COPY_VARIANTS)[number], ChevronStrokeStyle> = {
  regular: { stroke: 2.43, linecap: 'round', linejoin: 'round' },
  compact: { stroke: 2.14, linecap: 'round', linejoin: 'round' },
}

// The edit mark: `regular` is the outlined pencil with its rule, `solid` the
// filled pencil, for an affordance that already sits among filled marks.
export const EDIT_VARIANTS = ['regular', 'solid'] as const
export type EditVariant = (typeof EDIT_VARIANTS)[number]
export const EDIT_STYLE: Record<(typeof EDIT_VARIANTS)[number], ChevronStrokeStyle> = {
  regular: { stroke: 1.82, linecap: 'round', linejoin: 'round' },
  solid: { stroke: 0, linecap: 'round', linejoin: 'round' },
}

/**
 * Every glyph that carries variants, keyed by its file name in `src/lib/icons`.
 * The spec pairs each rendering with its style through this table.
 */
export const VARIANT_LADDERS: Record<string, IconVariantLadder> = {
  'ChevronDownIcon.svelte': { variants: CHEVRON_VARIANTS, styles: CHEVRON_VARIANTS.map((v) => CHEVRON_STYLE[v]) },
  'ChevronLeftIcon.svelte': { variants: CHEVRON_VARIANTS, styles: CHEVRON_VARIANTS.map((v) => CHEVRON_STYLE[v]) },
  'ChevronRightIcon.svelte': { variants: CHEVRON_VARIANTS, styles: CHEVRON_VARIANTS.map((v) => CHEVRON_STYLE[v]) },
  'ChevronUpIcon.svelte': { variants: CHEVRON_VARIANTS, styles: CHEVRON_VARIANTS.map((v) => CHEVRON_STYLE[v]) },
  'DoubleChevronDownIcon.svelte': { variants: DOUBLE_CHEVRON_VARIANTS, styles: DOUBLE_CHEVRON_VARIANTS.map((v) => DOUBLE_CHEVRON_STYLE[v]) },
  'DoubleChevronLeftIcon.svelte': { variants: DOUBLE_CHEVRON_VARIANTS, styles: DOUBLE_CHEVRON_VARIANTS.map((v) => DOUBLE_CHEVRON_STYLE[v]) },
  'DoubleChevronRightIcon.svelte': { variants: DOUBLE_CHEVRON_VARIANTS, styles: DOUBLE_CHEVRON_VARIANTS.map((v) => DOUBLE_CHEVRON_STYLE[v]) },
  'DoubleChevronUpIcon.svelte': { variants: DOUBLE_CHEVRON_VARIANTS, styles: DOUBLE_CHEVRON_VARIANTS.map((v) => DOUBLE_CHEVRON_STYLE[v]) },
  'CopyIcon.svelte': { variants: COPY_VARIANTS, styles: COPY_VARIANTS.map((v) => COPY_STYLE[v]) },
  'EditIcon.svelte': { variants: EDIT_VARIANTS, styles: EDIT_VARIANTS.map((v) => EDIT_STYLE[v]) },
}
