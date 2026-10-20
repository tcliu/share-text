// The one clear-affordance prop group shared by every field/listbox surface
// that renders the shared clear button, so the surface is declared once instead
// of copy-pasted per component (see `input-chrome.ts` for the same pattern on
// the field chrome). A field whose right edge is already taken documents how
// `auto` resolves for it.

export interface ClearableProps {
  // Appends a cross button that clears the value while one is set. Off by
  // default so existing callers are unchanged.
  clearable?: boolean
  // Accessible name for the clear button.
  clearLabel?: string
  // Where the clear button renders: `inside` overlays the field's own right
  // edge; `outside` sits after it as a sibling for a field whose right edge is
  // already taken (e.g. number steppers); `auto` picks the field's documented
  // default.
  clearPlacement?: 'auto' | 'inside' | 'outside'
  // Clear handler; falls back to clearing the bound value when omitted.
  onClear?: () => void
}
