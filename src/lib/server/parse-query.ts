export function parsePositiveInt(value: string | null) {
  if (value === null) {
    return null
  }
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseNonNegativeInt(value: string | null) {
  if (value === null) {
    return 0
  }
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export interface SearchParams {
  search?: string
  searchKeys: string[]
}

export function parseSearchParams(url: URL): SearchParams {
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 200)
  const searchKeys = (url.searchParams.get('search-keys') ?? '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean)
    .slice(0, 20)
  return { search: search || undefined, searchKeys }
}
