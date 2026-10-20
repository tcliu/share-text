// Shared label overrides for the Pagination control. Every field is optional:
// an unset field falls back to the component's own i18n key, so a caller
// replaces only the labels it wants to change.
export interface PaginationLabels {
  previous?: string
  next?: string
  pageSize?: string
  current?: string
  nav?: string
}
