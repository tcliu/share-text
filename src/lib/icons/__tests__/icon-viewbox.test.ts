// Guards the shared icon viewport convention: every square glyph is authored
// directly in the one square viewBox — its artwork already normalized to fill
// the viewBox on the dominant axis and written on the 0.01 unit grid, so no
// per-icon `<g transform>` fit sits between the artwork and the grid — and only
// the caret family keeps a non-square, tight crop. See ARCHITECTURE.md (Icon
// glyphs).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHEVRON_STYLE, CHEVRON_VARIANTS } from '../chevron-stroke'

const dir = join(process.cwd(), 'src/lib/icons')
const files = readdirSync(dir).filter(f => f.endsWith('.svelte'))
const carets = ['CaretUpIcon.svelte', 'CaretDownIcon.svelte', 'CaretLeftIcon.svelte', 'CaretRightIcon.svelte']
const nonSquare = new Set(carets)
const BOX = 20
const FILL = 0.97
const SLACK = 0.6

const read = (f: string) => readFileSync(join(dir, f), 'utf8')

// Geometry attributes whose values are painted coordinates: the bake writes
// them on the icon grid, so each number is an integer or a two-decimal step.
const GEOMETRY_ATTRS = / (?:d|cx|cy|r|rx|ry|x|y|width|height|x1|y1|x2|y2)="([^"]+)"/g

// ---- path geometry ------------------------------------------------------
// The ink box has to be exact: a curve can reach past its endpoints, so cubic
// and quadratic control points are collected (a superset of the curve, so the
// box is only ever widened) along with the axis extrema an ellipse arc sweeps
// through.
const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 }

function arcPoints(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): number[][] {
  // Endpoint -> center parameterization for an axis-aligned arc (SVG spec).
  let dx = (x1 - x2) / 2
  let dy = (y1 - y2) / 2
  const lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (lambda > 1) {
    const scale = Math.sqrt(lambda)
    rx *= scale
    ry *= scale
    dx /= scale
    dy /= scale
  }
  const rx2 = rx * rx
  const ry2 = ry * ry
  const numerator = rx2 * ry2 - rx2 * dy * dy - ry2 * dx * dx
  const denominator = rx2 * dy * dy + ry2 * dx * dx
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator))
  const cx = factor * ((rx * dy) / ry) + (x1 + x2) / 2
  const cy = factor * ((-ry * dx) / rx) + (y1 + y2) / 2
  const start = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx)
  const end = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx)
  const TAU = Math.PI * 2
  let delta = end - start
  if (sweep === 1) while (delta < 0) delta += TAU
  else while (delta > 0) delta -= TAU

  const points = [
    [x1, y1],
    [x2, y2],
  ]
  for (let quadrant = 0; quadrant < 4; quadrant += 1) {
    const angle = (quadrant * Math.PI) / 2
    const offset = (((angle - start) % TAU) + TAU) % TAU
    const swept = delta >= 0 ? offset <= delta : offset >= TAU + delta
    if (swept) points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)])
  }
  return points
}

function pathPoints(d: string): number[][] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const points: number[][] = []
  let cmd: string | null = null
  let x = 0
  let y = 0
  let cubic: number[] | null = null
  let quadratic: number[] | null = null
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i]!
    if (/[A-Za-z]/.test(token)) {
      cmd = token === 'Z' || token === 'z' ? null : token
      i += 1
      continue
    }
    if (!cmd) throw new Error(`number without a command in "${d}"`)
    const arity = ARITY[cmd.toLowerCase()] ?? 0
    const args = tokens.slice(i, i + arity).map(Number)
    if (args.length !== arity || args.some(Number.isNaN)) throw new Error(`bad arguments for ${cmd} in "${d}"`)
    i += arity
    const relative = cmd === cmd.toLowerCase()
    const upper = cmd.toUpperCase()
    const atX = (k: number) => (relative ? x + args[k]! : args[k]!)
    const atY = (k: number) => (relative ? y + args[k]! : args[k]!)
    // Each command resolves every coordinate from the pre-command current
    // point, so relative arguments never compound.
    switch (upper) {
      case 'M':
      case 'L': {
        x = atX(0)
        y = atY(1)
        points.push([x, y])
        cubic = quadratic = null
        break
      }
      case 'H': {
        x = atX(0)
        points.push([x, y])
        cubic = quadratic = null
        break
      }
      case 'V': {
        y = atY(0)
        points.push([x, y])
        cubic = quadratic = null
        break
      }
      case 'C': {
        // Bezier control points bound the curve, so they stand in for it.
        const c1 = [atX(0), atY(1)]
        const c2 = [atX(2), atY(3)]
        points.push(c1, c2)
        cubic = c2
        quadratic = null
        x = atX(4)
        y = atY(5)
        points.push([x, y])
        break
      }
      case 'S': {
        const c1 = cubic ? [2 * x - cubic[0]!, 2 * y - cubic[1]!] : [x, y]
        const c2 = [atX(0), atY(1)]
        points.push(c1, c2)
        cubic = c2
        quadratic = null
        x = atX(2)
        y = atY(3)
        points.push([x, y])
        break
      }
      case 'Q': {
        const c1 = [atX(0), atY(1)]
        points.push(c1)
        quadratic = c1
        cubic = null
        x = atX(2)
        y = atY(3)
        points.push([x, y])
        break
      }
      case 'T': {
        const c1: number[] = quadratic ? [2 * x - quadratic[0]!, 2 * y - quadratic[1]!] : [x, y]
        points.push(c1)
        quadratic = c1
        cubic = null
        x = atX(0)
        y = atY(1)
        points.push([x, y])
        break
      }
      case 'A': {
        const end = [atX(5), atY(6)]
        points.push(...arcPoints(x, y, args[0]!, args[1]!, args[3]!, args[4]!, end[0]!, end[1]!))
        cubic = quadratic = null
        x = end[0]!
        y = end[1]!
        break
      }
      default:
        throw new Error(`unsupported command ${cmd} in "${d}"`)
    }
  }
  return points
}

// Every painted point of one icon, in viewBox units.
function geometryPoints(markup: string): number[][] {
  const points: number[][] = []
  for (const [, d] of markup.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)) points.push(...pathPoints(d!))
  for (const [, attrs] of markup.matchAll(/<circle\b([^>]*)>/g)) {
    const cx = Number(attrs!.match(/\scx="([^"]*)"/)![1])
    const cy = Number(attrs!.match(/\scy="([^"]*)"/)![1])
    const r = Number(attrs!.match(/\sr="([^"]*)"/)![1])
    points.push([cx - r, cy - r], [cx + r, cy + r])
  }
  for (const [, attrs] of markup.matchAll(/<rect\b([^>]*)>/g)) {
    const x = Number(attrs!.match(/\sx="([^"]*)"/)![1])
    const y = Number(attrs!.match(/\sy="([^"]*)"/)![1])
    const w = Number(attrs!.match(/\swidth="([^"]*)"/)![1])
    const h = Number(attrs!.match(/\sheight="([^"]*)"/)![1])
    points.push([x, y], [x + w, y + h])
  }
  for (const [, attrs] of markup.matchAll(/<line\b([^>]*)>/g)) {
    points.push(
      [Number(attrs!.match(/\sx1="([^"]*)"/)![1]), Number(attrs!.match(/\sy1="([^"]*)"/)![1])],
      [Number(attrs!.match(/\sx2="([^"]*)"/)![1]), Number(attrs!.match(/\sy2="([^"]*)"/)![1])],
    )
  }
  return points
}

describe('icon viewport', () => {
  it('every square glyph is authored in the one square viewBox with no fit transform', () => {
    for (const f of files) {
      if (nonSquare.has(f)) continue
      const src = read(f)
      expect(src, f).toContain(`viewBox="0 0 ${BOX} ${BOX}"`)
      expect(src, f).not.toContain('transform=')
    }
  })

  it('square glyph geometry stays on the 0.01 unit icon grid', () => {
    for (const f of files) {
      if (nonSquare.has(f)) continue
      for (const [, value] of read(f).matchAll(GEOMETRY_ATTRS)) {
        for (const number of value!.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []) {
          expect(number, `${f}: ${value}`).toMatch(/^-?\d+(?:\.\d{1,2})?$/)
        }
      }
    }
  })

  // The axis-aligned ink box of a point set.
  function boxOf(points: number[][]): { x0: number; y0: number; x1: number; y1: number } {
    const xs = points.map(p => p[0]!)
    const ys = points.map(p => p[1]!)
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  }

  // A glyph's ink box: its painted points padded by half its stroke — the
  // conservative bound used for curved glyphs and rounded strokes.
  function paddedInkBox(markup: string, half: number) {
    const { x0, x1, y0, y1 } = boxOf(geometryPoints(markup))
    return { x0: x0 - half, x1: x1 + half, y0: y0 - half, y1: y1 + half }
  }

  // The exact ink outline of a stroked polyline: each segment's band corners
  // plus the cap/join extensions — a disc at a round cap or join, a miter tip at
  // a mitred corner. The chevron family's bold variant is flat-ended and
  // mitred, so its box is tighter than the padded bound would suggest.
  function strokedInkPoints(points: number[][], half: number, cap: string, join: string): number[][] {
    const ink: number[][] = []
    const disc = (x: number, y: number) => ink.push([x - half, y - half], [x + half, y + half])
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, ay] = points[i]!
      const [bx, by] = points[i + 1]!
      const length = Math.hypot(bx - ax, by - ay)
      if (length === 0) continue
      const nx = (-(by - ay) / length) * half
      const ny = ((bx - ax) / length) * half
      ink.push([ax + nx, ay + ny], [ax - nx, ay - ny], [bx + nx, by + ny], [bx - nx, by - ny])
    }
    if (cap === 'round') {
      disc(points[0]![0]!, points[0]![1]!)
      disc(points[points.length - 1]![0]!, points[points.length - 1]![1]!)
    }
    for (let i = 1; i < points.length - 1; i += 1) {
      const [vx, vy] = points[i]!
      if (join === 'round') {
        disc(vx, vy)
        continue
      }
      const [px, py] = points[i - 1]!
      const [qx, qy] = points[i + 1]!
      const l1 = Math.hypot(px - vx, py - vy)
      const l2 = Math.hypot(qx - vx, qy - vy)
      const bx = (px - vx) / l1 + (qx - vx) / l2
      const by = (py - vy) / l1 + (qy - vy) / l2
      const span = Math.hypot(bx, by)
      if (span === 0) continue
      // |u1+u2| = 2·cos(θ/2); the miter reaches half/sin(θ/2) from the vertex.
      const miter = half / Math.sqrt(1 - (span / 2) ** 2)
      ink.push([vx + (bx / span) * miter, vy + (by / span) * miter])
      ink.push([vx - (bx / span) * miter, vy - (by / span) * miter])
    }
    return ink
  }

  function expectFillsAndFits(
    { x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number },
    label: string,
  ) {
    expect(Math.max(x1 - x0, y1 - y0) / BOX, `${label} fill`).toBeGreaterThan(FILL)
    expect(x0, `${label} overhang`).toBeGreaterThan(-SLACK)
    expect(y0, `${label} overhang`).toBeGreaterThan(-SLACK)
    expect(x1, `${label} overhang`).toBeLessThan(BOX + SLACK)
    expect(y1, `${label} overhang`).toBeLessThan(BOX + SLACK)
  }

  it('square glyph ink fills the viewBox on its dominant axis and stays inside it', () => {
    for (const f of files) {
      if (nonSquare.has(f)) continue
      const src = read(f)
      const markup = src.match(/<svg\b[\s\S]*<\/svg>/)![0]
      if (src.includes('CHEVRON_STYLE')) {
        // One path per variant, listed in `CHEVRON_VARIANTS` order: pair each
        // with its own stroke style, so the heavier bold stroke is bounded
        // against its inset, flat-ended artwork rather than the regular path.
        const paths = [...markup.matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*\/>/g)].map(m => m[1]!)
        expect(paths.length, `${f} path count`).toBe(CHEVRON_VARIANTS.length)
        CHEVRON_VARIANTS.forEach((variant, index) => {
          const style = CHEVRON_STYLE[variant]
          const ink = [...paths[index]!.matchAll(/M[^M]*/g)].flatMap(part =>
            strokedInkPoints(pathPoints(part[0]!), style.stroke / 2, style.linecap, style.linejoin),
          )
          expectFillsAndFits(boxOf(ink), `${f} ${variant}`)
        })
        continue
      }
      const strokes = [...markup.matchAll(/stroke-width="([^"]*)"/g)].map(m => Number(m[1]))
      expectFillsAndFits(paddedInkBox(markup, (strokes.length ? Math.max(...strokes) : 0) / 2), f)
    }
  })

  it('the caret family keeps its tight non-square crop', () => {
    // Up/down crop 12x8 and render two-thirds tall; left/right are the same
    // triangle a quarter turn round, so they crop 8x12 and render two-thirds
    // wide.
    for (const f of ['CaretUpIcon.svelte', 'CaretDownIcon.svelte']) {
      expect(read(f), f).toMatch(/viewBox="4 \d+ 12 8"/)
      expect(read(f), f).toContain('height={(resolveIconPx(size) * 8) / 12}')
    }
    for (const f of ['CaretLeftIcon.svelte', 'CaretRightIcon.svelte']) {
      expect(read(f), f).toMatch(/viewBox="\d+ 4 8 12"/)
      expect(read(f), f).toContain('width={(resolveIconPx(size) * 8) / 12}')
    }
  })
})
