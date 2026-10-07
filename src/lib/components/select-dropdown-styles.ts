import { TEXT_SIZE, type TextSize } from '$lib/text-size'
import { SIZE_PX, bracketSteps, lerp, nearestStep, resolveSizeStep, type SizeInput } from '$lib/size-scale'

// One padding value per size (Button-style `px-* py-*`) shared by the trigger
// boxes, the option rows, and the empty row. The chevron is a flow child of
// the box, so it renders identically in both trigger variants; a small
// negative right margin (see `triggerChevron`) pulls it toward the edge
// without touching that single box padding. `minW` floors every surface so an
// empty query cannot collapse the trigger.
export const SIZE_CLASS = {
  xs: { pad: 'px-2.5 py-1.5', minW: 'min-w-20', icon: 'sm' },
  sm: { pad: 'px-3 py-2', minW: 'min-w-28', icon: 'sm' },
  md: { pad: 'px-3 py-2.5', minW: 'min-w-36', icon: 'md' },
  lg: { pad: 'px-4 py-3', minW: 'min-w-44', icon: 'lg' },
} as const

// Numeric sizes are positions on the shared scale (`$lib/size-scale`): names
// are aliases for its steps, other numbers interpolate between them (see
// `resolveSelectGeometry`), so `size={14}` renders between `xs` and `sm`.
export { SIZE_PX } from '$lib/size-scale'

export type SelectSize = SizeInput

// Rendered geometry for one size step, in whole pixels (Tailwind spacing and
// type-scale values behind the four steps above).
interface StepGeometry {
  fontPx: number
  padXPx: number
  padYPx: number
  minWPx: number
}

const STEP_GEOMETRY: Record<TextSize, StepGeometry> = {
  xs: { fontPx: 11, padXPx: 10, padYPx: 6, minWPx: 80 },
  sm: { fontPx: 13, padXPx: 12, padYPx: 8, minWPx: 112 },
  md: { fontPx: 15, padXPx: 12, padYPx: 10, minWPx: 144 },
  lg: { fontPx: 18, padXPx: 16, padYPx: 12, minWPx: 176 },
}

export interface SelectGeometry extends StepGeometry {
  // Nearest named step (fallback only; the chevron reads iconPx).
  step: TextSize
  // Icon pixels: the clamped input for numbers, the step value for names.
  iconPx: number
  // False for names and exact step hits: those render through the literal
  // classes below, byte-identical to before. True only for interpolated
  // numbers, which render through the bases plus an inline style.
  custom: boolean
}

// Nearest named step for wrappers that keep stepped chrome while forwarding
// the raw size to an inner interpolating component (e.g. Pagination's
// page-size dropdown). Canonical implementation lives in `$lib/size-scale`.
export const resolveSelectStep = resolveSizeStep

export function resolveSelectGeometry(size: SelectSize): SelectGeometry {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    const step = typeof size === 'string' ? size : 'sm'
    return { step, iconPx: SIZE_PX[step], custom: false, ...STEP_GEOMETRY[step] }
  }
  // Sizes run from 1px with no upper bound. Below the scale the xs→sm slope
  // continues downward; above it the md→lg slope continues upward.
  const bounded = Math.max(1, size)
  const step = nearestStep(bounded)
  if (bounded === SIZE_PX[step]) {
    return { step, iconPx: bounded, custom: false, ...STEP_GEOMETRY[step] }
  }
  // Every metric interpolates between the bracketing steps. Line-height is
  // deliberately not interpolated (the md step inherits it), so custom sizes
  // inherit it too.
  const { lo, hi, t } = bracketSteps(bounded)
  const loGeometry = STEP_GEOMETRY[lo]
  const hiGeometry = STEP_GEOMETRY[hi]
  return {
    step,
    iconPx: bounded,
    custom: true,
    fontPx: lerp(loGeometry.fontPx, hiGeometry.fontPx, t),
    padXPx: lerp(loGeometry.padXPx, hiGeometry.padXPx, t),
    padYPx: lerp(loGeometry.padYPx, hiGeometry.padYPx, t),
    minWPx: lerp(loGeometry.minWPx, hiGeometry.minWPx, t),
  }
}

// Inline geometry for interpolated sizes; undefined for named steps and exact
// hits, which render through the literal classes below. A class override
// suppresses it (the override owns the metrics), so callers never fight it.
export function selectGeometryStyle(geometry: SelectGeometry): string | undefined {
  if (!geometry.custom) {
    return undefined
  }
  return `font-size:${geometry.fontPx}px;padding:${geometry.padYPx}px ${geometry.padXPx}px;min-width:${geometry.minWPx}px`
}

// Default floating panel chrome; a `panelClass` override replaces it. The
// per-size min-width lives on the trigger and option rows (see `SIZE_CLASS`),
// because the positioner floors the panel root to the trigger width via
// inline style.
export const DEFAULT_PANEL_CLASS =
  'w-max max-w-xs max-h-[min(50vh,20rem)] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur'

// One box class for both trigger variants: the border, surface, padding, and
// chevron inset are identical whether the box holds a button or the filterable
// input, so the two render the same. The filterable box is a `label` so a click
// anywhere in the padding forwards to the input natively instead of adding a
// click handler to a non-interactive element. Only the focus trigger differs
// (the input is focused indirectly through the box). Hover tints the border
// while keyboard focus draws a ring with the border transparent, so a hovered
// trigger and the focused trigger are never mistaken for each other — a
// pointer can hover one while focus sits on another.
// Metric-free bases for interpolated sizes: the same chrome as the builders
// below minus min-width, padding, and text size, which the inline geometry
// style carries instead. The builders reassemble these so named steps render
// byte-identical strings to before.
export const TRIGGER_BASE =
  'inline-flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 text-left text-slate-100 outline-none transition motion-reduce:transition-none hover:border-cyan-500'
export const OPTION_BASE =
  'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md text-left outline-none transition-none max-[27.999rem]:min-h-11'
export const EMPTY_BASE = 'text-slate-400'

export function boxClass(size: TextSize): string {
  return `${SIZE_CLASS[size].minW} ${TRIGGER_BASE} ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`
}

// Phone viewports get a 44px minimum row height via pure CSS so in-dialog
// dropdowns stay thumb-friendly without switching to a bottom sheet, which
// must never stack inside a dialog. Cutoff mirrors PHONE_SHEET_MAX in
// dropdown-chrome (single shared value); the literal stays inline so Tailwind
// can see the class — keep them in sync.
export function optionRowClass(size: TextSize): string {
  // No transition: the active-row highlight must paint instantly so held
  // ArrowUp/ArrowDown repeat (via flushSync) reads as immediate instead of
  // re-triggering a 150ms color fade on every repeat.
  return `${SIZE_CLASS[size].minW} ${OPTION_BASE} ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`
}

export function emptyClass(size: TextSize): string {
  return `${SIZE_CLASS[size].minW} ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]} ${EMPTY_BASE}`
}
