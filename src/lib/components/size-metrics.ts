import { SIZE_PX, type SizeInput } from '$lib/size-scale'

// The size dimension in pixels: a numeric size, or a name aliased to the shared
// scale. Names need no table — they are just the axis values.
export function resolveSize(size: SizeInput): number {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return Math.max(1, size)
  }
  return SIZE_PX[typeof size === 'string' ? size : 'md'] ?? SIZE_PX.md
}

// A proportional metric is ratio × dimension. There is nothing to interpolate
// because the ratio is constant, so no per-step anchor table is needed — names
// resolve through `resolveSize` like any other size.
export function dimensionMetrics<R extends Record<string, number>>(
  size: SizeInput,
  ratios: R,
): { [K in keyof R]: number } {
  const dimension = resolveSize(size)
  const out = {} as { [K in keyof R]: number }
  for (const key of Object.keys(ratios) as (keyof R)[]) {
    out[key] = dimension * ratios[key]
  }
  return out
}

// An icon-only box stands in for the text row of the same control, so its box
// must measure the same: icon + 2·iconPad == line + 2·padY, i.e.
// iconPad = padY + (line - icon) / 2. Deriving the ratio keeps the two from
// drifting when padY or line is tuned — a hand-copied iconPad goes stale.
export function iconPadRatio(ratios: { padY: number; line: number; icon: number }): number {
  return ratios.padY + (ratios.line - ratios.icon) / 2
}

// Render resolved metrics as prefixed CSS custom properties for an element's
// inline `style`; the element's own static utility set consumes them. Prefixing
// per component keeps nested instances from colliding. Every metric is a length,
// so each value is emitted in pixels.
export function sizeVarStyle(prefix: string, metrics: Record<string, number>): string {
  return Object.entries(metrics)
    .map(([key, value]) => {
      // camelCase metric keys become kebab-case custom properties
      // (`padY` → `--btn-pad-y`) so the static utilities can reference them.
      const name = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
      return `--${prefix}-${name}:${value}px`
    })
    .join(';')
}

export interface SizeVarOptions {
  prefix: string
  metrics: Record<string, number>
}

// Svelte action applying the same metric custom properties as `sizeVarStyle`
// directly onto a node, one property at a time. A portalled panel is detached
// from the sized root, so it cannot inherit the root's custom-property set, and
// a `style` binding would replace the inline styles the positioner owns
// (`left`/`top`/`visibility`); this writes the variables without touching those.
export function sizeVarAction(node: HTMLElement, options: SizeVarOptions) {
  function apply({ prefix, metrics }: SizeVarOptions) {
    for (const declaration of sizeVarStyle(prefix, metrics).split(';')) {
      if (!declaration) continue
      const separator = declaration.indexOf(':')
      node.style.setProperty(declaration.slice(0, separator), declaration.slice(separator + 1))
    }
  }
  apply(options)
  return {
    update(next: SizeVarOptions) {
      apply(next)
    },
  }
}
