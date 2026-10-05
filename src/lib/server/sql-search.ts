/**
 * Appends a case-insensitive substring search condition across the requested
 * searchable columns. Uses leading-wildcard LIKE patterns which defeat B-tree
 * index scans. Acceptable for SQLite (no trigram index available) and
 * small-to-medium Postgres datasets. For large Postgres deployments the prod
 * migration (`PROD_MIGRATIONS` in `db.ts`) adds a pg_trgm GIN index on
 * `lower(name)`, the default search column; searching other selected columns
 * would need a per-column trigram index.
 */
export function appendSearchConditions(options: {
  search: string
  searchKeys: string[]
  columns: Record<string, string>
  defaultKeys: string[]
  conditions: string[]
  params: unknown[]
}) {
  const { search, searchKeys, columns, defaultKeys, conditions, params } = options
  const searchColumns = (searchKeys.length > 0 ? searchKeys : defaultKeys)
    .map(key => columns[key])
    .filter((column): column is string => Boolean(column))
  if (searchColumns.length === 0) {
    conditions.push('1 = 0')
    return
  }
  const likeClauses: string[] = []
  for (const column of searchColumns) {
    params.push(`%${search.toLowerCase()}%`)
    likeClauses.push(`lower(${column}) like $${params.length}`)
  }
  conditions.push(`(${likeClauses.join(' or ')})`)
}
