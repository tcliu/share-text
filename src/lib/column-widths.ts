// The app's own localStorage prefix for persisted column widths. The package
// store writes here and keeps its canonical prefix as the read fallback, so
// layouts saved before the package migration still restore and then migrate.
export const COLUMN_WIDTH_PREFIX = 'share-text:column-widths:'
