// Shared card contract: the generic `GET /api/info` self-card
// every managed project exposes, and the envelope a catalog list endpoint
// carries. Each project supplies its own app props; the shape and
// the flat-vs-`self` resolution stay identical everywhere. Framework-agnostic
// on purpose — projects can copy this file verbatim and only change props.
export interface CardPayload {
  id?: unknown
  name?: unknown
  icon?: unknown
  description?: unknown
  branch?: unknown
  repo?: unknown
  status?: unknown
  url?: unknown
  // `profile` is the app's runtime profile (`dev`/`prod`), supplied by each
  // project's `/api/info` from its runtime profile env var; apps without one
  // leave it absent and it normalizes to `null`.
  profile?: unknown
  tags?: unknown
  active?: unknown
}

export interface NormalizedCard {
  id: string
  name: string
  icon: string | null
  description: string | null
  branch: string | null
  repo: string | null
  status: 'Active' | 'Inactive'
  url: string | null
  // Runtime profile (`dev`/`prod`) or `null`; see CardPayload.profile.
  profile: string | null
  tags: string[]
  active: boolean
}
const VALID_STATUSES: Record<string, 'Active' | 'Inactive'> = { Active: 'Active', Inactive: 'Inactive' }

function trimToNull(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

// `active` is an operator opt-out carried through `/api/info`: absent/true
// keeps the project discoverable, an explicit false makes a catalog scan skip
// it. Only recognized false spellings opt out, so a typo never hides a project.
const CARD_FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

function normalizeCardBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const text = trimToNull(value)
  if (text === null) return true
  return !CARD_FALSE_VALUES.has(text.toLowerCase())
}

// Lightweight tag coercion only (trim, drop empties, dedupe). This file stays
// dependency-free so projects keep copying it verbatim; the full tag policy
// (caps, truncation) is enforced downstream when the record is stored.
function normalizeCardTags(value: unknown): string[] {
  const list = typeof value === 'string' ? value.split(',') : value
  if (!Array.isArray(list)) {
    return []
  }
  const seen = new Set<string>()
  const tags: string[] = []
  for (const entry of list) {
    if (typeof entry !== 'string' && typeof entry !== 'number') {
      continue
    }
    const tag = String(entry).trim()
    if (!tag) {
      continue
    }
    const key = tag.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    tags.push(tag)
  }
  return tags
}
export function normalizeCard(payload: CardPayload): NormalizedCard {
  const id = trimToNull(payload.id)
  const name = trimToNull(payload.name)
  if (!id) {
    throw new Error('Card is missing required id.')
  }
  if (!name) {
    throw new Error('Card is missing required name.')
  }
  const status = trimToNull(payload.status)
  return {
    id,
    name,
    icon: trimToNull(payload.icon),
    description: trimToNull(payload.description),
    branch: trimToNull(payload.branch),
    repo: trimToNull(payload.repo),
    status: (status && VALID_STATUSES[status]) || 'Active',
    url: trimToNull(payload.url),
    profile: trimToNull(payload.profile),
    tags: normalizeCardTags(payload.tags),
    active: normalizeCardBoolean(payload.active),
  }
}

// Accepts either a flat self-card or a list envelope carrying it under
// `self` (`{ ..., self: { ... } }`).
export function resolveCardPayload(response: unknown): CardPayload {
  if (!response || typeof response !== 'object') {
    throw new Error('Response is not a JSON object.')
  }
  const record = response as { self?: unknown } & CardPayload
  const candidate = record.self !== undefined ? record.self : response
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Response is missing a card object.')
  }
  return candidate as CardPayload
}
