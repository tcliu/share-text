import { getDefaultTagColor, isTagColor, pickTagColor, sameColorFamily, type Tag } from './tag-colors'

/**
 * Normalize an incoming tags payload (from requests or DB) into a
 * canonical array of Tag objects: deduplicated (case-insensitive name),
 * trimmed names, valid colors, sorted by name, and adjusted for adjacent
 * colour-family contrast.
 */
export function normalizeTags(value: unknown): Tag[] {
  if (!value) return []
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value))
    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const normalized: Tag[] = []
    for (const item of parsed) {
      if (typeof item === 'string') {
        const name = item.trim()
        const key = name.toLowerCase()
        if (!name || seen.has(key)) continue
        seen.add(key)
        normalized.push({ name, color: getDefaultTagColor(name) })
      } else if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
        const name = ((item as { name: string }).name ?? '').trim()
        const key = name.toLowerCase()
        if (!name || seen.has(key)) continue
        seen.add(key)
        const rawColor = (item as { color?: unknown }).color
        const color = typeof rawColor === 'string' && isTagColor(rawColor) ? rawColor : getDefaultTagColor(name)
        normalized.push({ name, color })
      }
    }

    // Sort and adjust for adjacent colour-family contrast.
    normalized.sort((a, b) => a.name.localeCompare(b.name))
    const result: Tag[] = []
    for (const tag of normalized) {
      const prev = result[result.length - 1]
      const color = prev && sameColorFamily(tag.color, prev.color) ? pickTagColor(tag.name, [prev.color]) : tag.color
      result.push({ name: tag.name, color })
    }
    return result
  } catch {
    return []
  }
}

/**
 * Serialize a normalized Tag[] into a JSON string suitable for storage.
 * If tags is undefined, returns '[]'.
 */
export function serializeTags(tags?: Tag[]): string {
  if (!tags) return '[]'
  // Re-normalize to enforce canonical ordering/colours before storing.
  const normalized = normalizeTags(tags)
  return JSON.stringify(normalized)
}
