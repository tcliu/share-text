export function keyOf(ri: number, ci: number): string {
  return `${ri}:${ci}`
}

export function cellOfKey(key: string): { ri: number; ci: number } {
  const [ri, ci] = key.split(':').map(Number)
  return { ri, ci }
}

export function isEmptyValue(value: string): boolean {
  return value.trim() === ''
}

export function matrixEqual(a: string[][], b: string[][]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let ri = 0; ri < a.length; ri++) {
    if (a[ri] === b[ri]) continue
    if (a[ri].length !== b[ri].length) return false
    for (let ci = 0; ci < a[ri].length; ci++) {
      if (a[ri][ci] !== b[ri][ci]) return false
    }
  }
  return true
}

export function rectOfKeys(keys: Set<string>): { r1: number; c1: number; r2: number; c2: number } | null {
  let r1 = Infinity
  let r2 = -Infinity
  let c1 = Infinity
  let c2 = -Infinity
  for (const key of keys) {
    const { ri, ci } = cellOfKey(key)
    r1 = Math.min(r1, ri)
    c1 = Math.min(c1, ci)
    r2 = Math.max(r2, ri)
    c2 = Math.max(c2, ci)
  }
  if (r2 < r1 || c2 < c1) return null
  return { r1, c1, r2, c2 }
}

export function keysInRect(r1: number, c1: number, r2: number, c2: number): Set<string> {
  const keys = new Set<string>()
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) keys.add(keyOf(r, c))
  }
  return keys
}

export function columnLetter(ci: number): string {
  let label = ''
  let n = ci + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

// Natural grid sort comparison: pure-numeric cells compare numerically, every
// thing else falls back to a locale-aware, case-insensitive, numeric-aware
// string compare. Used when sorting data rows by a column.
export function compareGridValues(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  const aNum = a.trim() !== '' && !Number.isNaN(na)
  const bNum = b.trim() !== '' && !Number.isNaN(nb)
  if (aNum && bNum) return na - nb
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
