export interface PreviewContentOptions {
  debounceMs?: number
}

// Mirrors `content` into a debounced value for preview rendering: typing is
// debounced so heavy previews don't re-render on every keystroke, but switching
// documents updates immediately so the preview never flashes stale content.
export function usePreviewContent(
  getContent: () => string,
  getDocumentId: () => string,
  options: PreviewContentOptions = {},
) {
  const debounceMs = options.debounceMs ?? 300
  let debounced = $state('')
  let lastDocumentId = $state<string | undefined>(undefined)

  $effect(() => {
    const documentId = getDocumentId()
    if (lastDocumentId === undefined || documentId !== lastDocumentId) {
      lastDocumentId = documentId
      debounced = getContent()
      return
    }
    const next = getContent()
    const timeout = setTimeout(() => {
      debounced = next
    }, debounceMs)
    return () => clearTimeout(timeout)
  })

  return {
    get value(): string {
      return debounced
    },
  }
}
