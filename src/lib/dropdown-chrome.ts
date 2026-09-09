/**
 * Shared chrome props for dropdown / menu / popover panels.
 * Extracted so `SelectDropdown` and `Menu` stay consistent
 * without copy-pasting the same three knobs.
 */

export type DropdownAlign = 'left' | 'right'

export interface DropdownPositionProps {
  /** Which edge of the trigger the panel is anchored to. */
  align?: DropdownAlign
  /** Flip to the opposite side when crowded (viewport clamping). */
  autoPlace?: boolean
}

export interface DropdownPanelProps extends DropdownPositionProps {
  /** Tailwind classes for the floating panel container. Override to theme per use. */
  panelClass?: string
}

/**
 * Phone-sheet viewport cutoff shared by `Menu` bottom sheets.
 * Mirrors `BaseDialog` sheet mode (Tailwind container token `md` = 28rem);
 * keep the two in sync or phone menus and phone dialogs diverge.
 */
export const PHONE_SHEET_MAX = '27.999rem'
export const PHONE_SHEET_QUERY = `(max-width: ${PHONE_SHEET_MAX})`
