export const TAG_COLORS = [
  '#00F0FF',
  '#FF6680',
  '#00FF99',
  '#FF33CC',
  '#FFE600',
  '#55A6FF',
  '#FF8800',
  '#F8FAFC',
  '#B5FF00',
  '#D466FF',
  '#FFCC00',
  '#80F3FF',
  '#FF80BF',
  '#55FF55',
  '#C2B3FF',
  '#FFAA80',
] as const

export type TagColor = (typeof TAG_COLORS)[number]

export interface Tag {
  name: string
  color: TagColor
}

const CHIP_BASE = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs'

export function tagChipClass(): string {
  return CHIP_BASE
}

export function tagChipStyle(color: string): string {
  const c = resolveColor(color)
  return `color: ${c}; border-color: color-mix(in srgb, ${c} 50%, transparent); background-color: color-mix(in srgb, ${c} 15%, transparent)`
}

const REMOVE_BTN_BASE =
  'flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-60 transition hover:opacity-100'

export function tagRemoveBtnClass(): string {
  return REMOVE_BTN_BASE
}

export function tagRemoveBtnStyle(color: string): string {
  return `color: ${resolveColor(color)}`
}

export function tagDotClass(): string {
  return 'h-2 w-2 rounded-full'
}

export function tagDotStyle(color: string): string {
  return `background-color: ${resolveColor(color)}`
}

export function isTagColor(value: string): value is TagColor {
  return (TAG_COLORS as readonly string[]).includes(value)
}

function resolveColor(color: string): string {
  return isTagColor(color) ? color : TAG_COLORS[0]
}

function hashTag(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getDefaultTagColor(name: string): TagColor {
  return TAG_COLORS[hashTag(name) % TAG_COLORS.length]
}

export function nextTagColor(count: number): TagColor {
  return TAG_COLORS[count % TAG_COLORS.length]
}

const COLOR_FAMILIES: Record<TagColor, string> = {
  '#00F0FF': 'cyan',
  '#FF6680': 'red',
  '#00FF99': 'green',
  '#FF33CC': 'purple',
  '#FFE600': 'orange',
  '#55A6FF': 'blue',
  '#FF8800': 'orange',
  '#F8FAFC': 'light',
  '#B5FF00': 'green',
  '#D466FF': 'purple',
  '#FFCC00': 'orange',
  '#80F3FF': 'cyan',
  '#FF80BF': 'purple',
  '#55FF55': 'green',
  '#C2B3FF': 'blue',
  '#FFAA80': 'orange',
}

function colorFamily(color: string): string {
  return COLOR_FAMILIES[color as TagColor] ?? COLOR_FAMILIES['#00F0FF']
}

export function sameColorFamily(a: string, b: string): boolean {
  return colorFamily(a) === colorFamily(b)
}

function hueDistance(a: string, b: string): number {
  const ai = TAG_COLORS.indexOf(a as TagColor)
  const bi = TAG_COLORS.indexOf(b as TagColor)
  if (ai === -1 || bi === -1) {
    return TAG_COLORS.length
  }
  const diff = Math.abs(ai - bi)
  return Math.min(diff, TAG_COLORS.length - diff)
}

export function pickTagColor(name: string, avoidColors: string[]): TagColor {
  const avoidFamilies = new Set(avoidColors.map(colorFamily))
  const defaultColor = getDefaultTagColor(name)
  if (!avoidFamilies.has(colorFamily(defaultColor))) {
    return defaultColor
  }
  const candidates = TAG_COLORS.filter(color => !avoidFamilies.has(colorFamily(color)))
  if (candidates.length === 0) {
    return defaultColor
  }
  let best = candidates[0]
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = hueDistance(defaultColor, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}
