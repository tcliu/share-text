// Canonical named-step scale shared by every sized component, so a numeric
// size means the same thing everywhere. Names are aliases for icon-scale
// pixels (the same steps the icons render); numbers are positions on that
// axis — interpolated or extrapolated by the caller, never a second scale.

export type SizeName = 'xs' | 'sm' | 'md' | 'lg'

export type SizeInput = SizeName | number

export const SIZE_PX: Record<SizeName, number> = { xs: 12, sm: 16, md: 20, lg: 24 }

export const SIZE_ORDER: SizeName[] = ['xs', 'sm', 'md', 'lg']

// Themed font pixels behind the text scale (see styles.css `@theme`).
export const FONT_PX: Record<SizeName, number> = { xs: 11, sm: 13, md: 15, lg: 18 }

export function nearestStep(size: number): SizeName {
  // Ties keep the earlier (smaller) step.
  let nearest: SizeName = SIZE_ORDER[0]
  let nearestGap = Math.abs(size - SIZE_PX[nearest])
  for (const step of SIZE_ORDER) {
    const gap = Math.abs(size - SIZE_PX[step])
    if (gap < nearestGap) {
      nearest = step
      nearestGap = gap
    }
  }
  return nearest
}

// Nearest named step for components that keep stepped chrome while accepting
// numbers. Names pass through; numbers resolve on the unbounded scale
// (minimum 1px).
export function resolveSizeStep(size: SizeInput): SizeName {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return typeof size === 'string' ? size : 'sm'
  }
  return nearestStep(Math.max(1, size))
}

// Tenth-pixel lerp, floored at zero so far-below-scale extrapolation cannot
// emit negative lengths.
export function lerp(lo: number, hi: number, t: number): number {
  return Math.max(0, Math.round((lo + (hi - lo) * t) * 10) / 10)
}

// Bracketing steps and blend factor for a bounded value on the axis.
export function bracketSteps(bounded: number): { lo: SizeName; hi: SizeName; t: number } {
  let lo: SizeName
  let hi: SizeName
  if (bounded < SIZE_PX.xs) {
    lo = 'xs'
    hi = 'sm'
  } else if (bounded > SIZE_PX.lg) {
    lo = 'md'
    hi = 'lg'
  } else {
    hi = SIZE_ORDER.find(candidate => SIZE_PX[candidate] > bounded) ?? 'lg'
    lo = [...SIZE_ORDER].reverse().find(candidate => SIZE_PX[candidate] < bounded) ?? 'xs'
  }
  return { lo, hi, t: (bounded - SIZE_PX[lo]) / (SIZE_PX[hi] - SIZE_PX[lo]) }
}

// Interpolated font size for a numeric input on the shared axis (names and
// exact hits return their step value). Used by text-only components that
// scale continuously instead of stepping.
export function resolveFontPx(size: SizeInput): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    const step = typeof size === 'string' ? size : 'sm'
    return FONT_PX[step]
  }
  const bounded = Math.max(1, size)
  const exact = nearestStep(bounded)
  if (bounded === SIZE_PX[exact]) {
    return FONT_PX[exact]
  }
  const { lo, hi, t } = bracketSteps(bounded)
  return lerp(FONT_PX[lo], FONT_PX[hi], t)
}
