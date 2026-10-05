/**
 * Reconciles an external `content` string into editable grid rows and back.
 *
 * The CSV and Properties previews render grid rows parsed from the document
 * content and serialize edits through `onContentChange`; the content prop then
 * echoes the serialized value, so the effect must recognize its own echo
 * instead of rebuilding the rows (which loops forever for content that does not
 * round-trip). Owning the guard here keeps the two previews' reconcile rules
 * from drifting apart.
 *
 * `content` is a getter because the effect must re-read the reactive prop; the
 * returned `rows`/`error` are getters so reading them in a template stays
 * reactive (do not destructure).
 */
export interface ContentReconcileOptions {
  content: () => string
  parse: (content: string) => { rows: string[][]; error: string | null }
  serialize: (rows: string[][]) => string
  onChange?: (content: string) => void
}

export function useContentReconcile(options: ContentReconcileOptions) {
  let rows = $state<string[][]>([])
  let error = $state<string | null>(null)
  let suppressSync = false
  let initialized = false
  // The raw content `rows` was last reconciled against, so each change is
  // parsed at most once.
  let lastContent: string | null = null

  $effect(() => {
    const current = options.content()
    if (lastContent === current) return
    if (!initialized) {
      initialized = true
      lastContent = current
      const parsed = options.parse(current)
      rows = parsed.rows
      error = parsed.error
      return
    }
    lastContent = current
    if (suppressSync) {
      suppressSync = false
      return
    }
    if (current !== options.serialize(rows)) {
      const parsed = options.parse(current)
      rows = parsed.rows
      error = parsed.error
    }
  })

  function handleChange(next: string[][]) {
    rows = next
    error = null
    suppressSync = true
    options.onChange?.(options.serialize(next))
  }

  return {
    get rows() {
      return rows
    },
    get error() {
      return error
    },
    handleChange,
  }
}
