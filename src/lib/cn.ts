import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join conditional class lists and resolve conflicting Tailwind utilities,
 * keeping the last one per utility group. Call sites keep utility classes
 * literal (see tailwind.md); this only merges values the scanner already saw.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
