export interface StructureEntry {
  key: string
  value: unknown
}

export function isContainer(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}

export function childEntries(value: unknown): StructureEntry[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ key: String(index), value: item }))
  }
  return Object.entries(value as Record<string, unknown>).map(([key, value]) => ({ key, value }))
}

export function containerSummary(value: unknown): string {
  if (Array.isArray(value)) {
    return `array[${value.length}]`
  }
  const count = Object.keys(value as Record<string, unknown>).length
  return `object{${count}}`
}

export function valueText(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

export function valueClass(value: unknown): string {
  if (value === null) return 'italic text-slate-500'
  if (typeof value === 'string') return 'text-emerald-300'
  if (typeof value === 'number') return 'text-amber-300'
  if (typeof value === 'boolean') return 'text-sky-300'
  return 'text-slate-300'
}

export function copyValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}
