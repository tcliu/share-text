<script lang="ts">
  import DataGrid from './DataGrid.svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { parseCsv, serializeCsv } from '$lib/csv-utils'

  let { content, onContentChange }: PreviewProps = $props()

  let parsedRows = $state(parseCsv(content))
  let suppressSync = false

  $effect(() => {
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
