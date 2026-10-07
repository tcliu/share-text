/**
 * Lowercased label/value index over an options array. Build it inside a
 * `$derived` so it recomputes only when the array changes; a filter pass then
 * reads the index instead of calling `toLowerCase()` on every option on every
 * keystroke (which also allocates a string per option).
 */
export interface IndexedOption<T> {
  option: T
  label: string
  value: string
}

export function createOptionIndex<T extends { label: string; value: string }>(options: T[]): IndexedOption<T>[] {
  return options.map(option => ({
    option,
    label: option.label.toLowerCase(),
    value: option.value.toLowerCase(),
  }))
}

/** Whether an indexed option matches a lowercased `needle` by label or value. */
export function matchesOption<T>(entry: IndexedOption<T>, needle: string): boolean {
  return entry.label.includes(needle) || entry.value.includes(needle)
}

/** A label split around its matched span. */
export interface MatchedLabelParts {
  before: string
  match: string
  after: string
}

/**
 * Split a label around its first case-insensitive occurrence of a lowercased
 * `needle`, or return null when the needle is empty or the label has no match
 * (an option matched by value only). Lets a filterable list emphasize the typed
 * part of the rows it shows.
 */
export function matchLabelParts(label: string, needle: string): MatchedLabelParts | null {
  if (needle === '') {
    return null
  }
  const at = label.toLowerCase().indexOf(needle)
  if (at < 0) {
    return null
  }
  return {
    before: label.slice(0, at),
    match: label.slice(at, at + needle.length),
    after: label.slice(at + needle.length),
  }
}
