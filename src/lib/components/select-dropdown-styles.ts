import { TEXT_SIZE, type TextSize } from '$lib/text-size'

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
export function boxClass(size: TextSize): string {
  return `${SIZE_CLASS[size].minW} inline-flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 text-left text-slate-100 outline-none transition motion-reduce:transition-none hover:border-cyan-500 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`
}

// Phone viewports get a 44px minimum row height via pure CSS so in-dialog
// dropdowns stay thumb-friendly without switching to a bottom sheet, which
// must never stack inside a dialog. Cutoff mirrors PHONE_SHEET_MAX in
// dropdown-chrome (single shared value); the literal stays inline so Tailwind
// can see the class — keep them in sync.
export function optionRowClass(size: TextSize): string {
  return `${SIZE_CLASS[size].minW} flex w-full cursor-pointer items-center justify-between gap-2 rounded-md text-left outline-none transition motion-reduce:transition-none max-[27.999rem]:min-h-11 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`
}

export function emptyClass(size: TextSize): string {
  return `${SIZE_CLASS[size].minW} ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]} text-slate-400`
}
