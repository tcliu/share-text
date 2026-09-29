import type { Tag } from './tag-colors'

/** Viewer-facing content-size label (locale grouping separators). */
export function formatContentSize(value: number) {
  return value.toLocaleString()
}

/** Comma-joined tag names for a table cell. */
export function formatTagNames(tags: Tag[] | undefined) {
  return tags?.map(tag => tag.name).join(', ') ?? ''
}
