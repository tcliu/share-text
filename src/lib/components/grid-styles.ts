// Presentation for the DataGrid's selection surfaces. The selection hook owns
// state and exposes semantic predicates; these pure helpers turn that state into
// the literal classes and styles the grid renders, so the hook stays free of
// palette and layout knowledge.

// The selection-outline color, shared by the border helpers below and the grid's
// multiline-editor overlay.
export const RANGE_COLOR = 'rgba(34, 211, 238, 0.6)'

export function gridCellClass(base: string, selected: boolean): string {
  return selected ? `${base} bg-slate-800 outline-none` : base
}

// The outline is drawn by recoloring the actual cell borders that form the grid
// lines: the border between `here` and an adjacent cell is colored when their
// selection states differ, so the outline is the set of grid lines between the
// highlighted region and the rest of the grid. `right`/`down` are the neighbor
// cells' selection states.
export function rangeHighlightStyle(here: boolean, right: boolean, down: boolean): string {
  const parts: string[] = []
  if (here !== down) parts.push(`border-bottom-color:${RANGE_COLOR}`)
  if (here !== right) parts.push(`border-right-color:${RANGE_COLOR}`)
  return parts.join(';')
}

// The column-label row's bottom border is the grid line above the header-data
// cell, so it carries the outline's top edge for a region touching the top.
export function labelRowBorderStyle(selectedBelow: boolean): string {
  return selectedBelow ? `border-bottom-color:${RANGE_COLOR}` : ''
}

// The select-all cell sits above the header-data row's first cell; its bottom
// border is the top edge of a region that includes cell (0, 0).
export function selectAllBorderStyle(selected: boolean): string {
  return selected ? `border-bottom-color:${RANGE_COLOR}` : ''
}

// The row-number cells' right borders are the grid lines left of column 0, so
// they carry the outline's left edge for a region touching column 0.
export function rowNumberBorderStyle(selected: boolean): string {
  return selected ? `border-right-color:${RANGE_COLOR}` : ''
}

export function rowSelectorClass(ri: number, selected: boolean): string {
  const bg = ri % 2 === 1 ? 'bg-slate-900' : 'bg-slate-950'
  return `sticky left-0 z-10 w-9 cursor-pointer border-b border-r border-b-slate-800 border-r-slate-500 p-0 text-right outline-none ${selected ? 'bg-slate-800' : bg}`
}

export function columnSelectorClass(selected: boolean, isLastColumn: boolean): string {
  const rightBorder = isLastColumn ? 'border-r-slate-800' : 'border-r-slate-500'
  return `min-w-32 h-6 cursor-pointer border-b border-r border-b-slate-600 ${rightBorder} p-0 text-center text-xs font-normal outline-none ${selected ? 'bg-slate-800' : ''}`
}

export function gridRowClass(index: number): string {
  return index % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900'
}
