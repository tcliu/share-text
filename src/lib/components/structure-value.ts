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

export function inputText(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return String(value)
}

export function parseInputValue(input: string): unknown {
  const trimmed = input.trim()
  if (trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const num = Number(trimmed)
  if (trimmed !== '' && Number.isFinite(num)) return num
  return trimmed
}

export function setAtPath(root: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value
  const [key, ...rest] = path
  if (Array.isArray(root)) {
    const index = parseInt(key, 10)
    const next = [...root]
    next[index] = setAtPath(root[index], rest, value)
    return next
  }
  return { ...(root as Record<string, unknown>), [key]: setAtPath((root as Record<string, unknown>)[key], rest, value) }
}

export function detectFormat(text: string): 'json' | 'yaml' {
  try {
    JSON.parse(text.trim() || 'null')
    return 'json'
  } catch {
    return 'yaml'
  }
}

export function renameKeyAtPath(root: unknown, path: string[], oldKey: string, newKey: string): unknown {
  if (oldKey === newKey) return root
  if (path.length === 0) {
    const obj = root as Record<string, unknown>
    if (!(oldKey in obj)) return root
    const rebuilt: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      if (key === oldKey) {
        rebuilt[newKey] = obj[key]
      } else {
        rebuilt[key] = obj[key]
      }
    }
    return rebuilt
  }
  const [head, ...rest] = path
  if (Array.isArray(root)) {
    const index = parseInt(head, 10)
    const next = [...root]
    next[index] = renameKeyAtPath(root[index], rest, oldKey, newKey)
    return next
  }
  return { ...(root as Record<string, unknown>), [head]: renameKeyAtPath((root as Record<string, unknown>)[head], rest, oldKey, newKey) }
}
