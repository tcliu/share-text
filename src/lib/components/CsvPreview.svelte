<script lang="ts">
  import DataGrid from './DataGrid.svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { parseCsv, serializeCsv } from '$lib/csv-utils'
  import { useContentReconcile } from './use-content-reconcile.svelte'

  let { content, onContentChange, editable = true }: PreviewProps = $props()

  const reconcile = useContentReconcile({
    content: () => content,
    parse: value => ({ rows: parseCsv(value), error: null }),
    serialize: rows => serializeCsv(rows),
    onChange: value => onContentChange?.(value),
  })
</script>

<DataGrid
  value={reconcile.rows}
  onChange={reconcile.handleChange}
  {editable}
  testId="csv-preview"
  storageKey="csv-preview" />
