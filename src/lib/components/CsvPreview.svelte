<script lang="ts">
  import DataGrid from './DataGrid.svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { parseCsv, serializeCsv } from '$lib/csv-utils'

  let { content, onContentChange }: PreviewProps = $props()

  function handleChange(rows: string[][]) {
    onContentChange?.(serializeCsv(rows))
  }
</script>

<DataGrid value={parseCsv(content)} onChange={handleChange} testId="csv-preview" />
