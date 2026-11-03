<script lang="ts">
  import DataGrid from '@codepg/ui-lib/components/DataGrid.svelte'
  import type { PreviewProps } from '#lib/document-types.js'
  import { parseCsv, serializeCsv } from '#lib/csv-utils.js'
  import { useContentReconcile } from './use-content-reconcile.svelte'
  import { COLUMN_WIDTH_PREFIX } from '#lib/column-widths.js'

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
  storageKey="csv-preview" storagePrefix={COLUMN_WIDTH_PREFIX} />
