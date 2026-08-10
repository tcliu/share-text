<script lang="ts">
  import DataGrid from './DataGrid.svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { parseCsv, serializeCsv } from '$lib/csv-utils'

  let { content, onContentChange }: PreviewProps = $props()

  let parsedRows = $state(parseCsv(content))
  let suppressSync = false
  // The raw content that `parsedRows` was last reconciled against. Content that
  // does not round-trip through serializeCsv/parseCsv (e.g. JSON text shown
  // after a type change) would otherwise make the reparse branch run every
  // effect pass and rebind a structurally-equal new array forever, freezing the
  // app. Guard on the content itself so each change is parsed at most once.
  let lastContent: string | null = null

  $effect(() => {
    if (content === lastContent) return
    lastContent = content
    if (suppressSync) {
      suppressSync = false
      return
    }
    const roundTripped = serializeCsv(parsedRows)
    if (content !== roundTripped) {
      parsedRows = parseCsv(content)
    }
  })

  function handleChange(rows: string[][]) {
    parsedRows = rows
    suppressSync = true
    onContentChange?.(serializeCsv(rows))
  }
</script>

<DataGrid value={parsedRows} onChange={handleChange} testId="csv-preview" />
