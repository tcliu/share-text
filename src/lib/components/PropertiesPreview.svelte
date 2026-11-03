<script lang="ts">
  import DataGrid from '@codepg/ui-lib/components/DataGrid.svelte'
  import type { PreviewProps } from '#lib/document-types.js'
  import { parseProperties, serializeProperties } from '#lib/document-type-utils.js'
  import { getI18nContext } from '#lib/i18n.svelte.js'
  import { useContentReconcile } from './use-content-reconcile.svelte'
  import { COLUMN_WIDTH_PREFIX } from '#lib/column-widths.js'
  const i18n = getI18nContext()

  let { content, onContentChange, editable = true }: PreviewProps = $props()

  function parseRows(text: string): { rows: string[][]; error: string | null } {
    const parsed = parseProperties(text)
    if (!parsed.ok) {
      return { rows: [], error: parsed.error ?? i18n.t('properties.invalid') }
    }
    return {
      rows: Object.entries(parsed.value ?? {}).map(([key, value]) => [key, value]),
      error: null,
    }
  }

  function serializeRows(rows: string[][]): string {
    const record: Record<string, string> = {}
    for (const row of rows) {
      const key = (row[0] ?? '').trim()
      if (key === '') continue
      record[key] = row[1] ?? ''
    }
    return serializeProperties(record)
  }

  const reconcile = useContentReconcile({
    content: () => content,
    parse: parseRows,
    serialize: serializeRows,
    onChange: value => onContentChange?.(value),
  })
</script>

{#if reconcile.error}
  <div data-testid="properties-preview" class="h-full overflow-auto p-4 text-slate-300">
    <div class="text-sm text-red-400">{i18n.t('structure.unableToParse', { error: reconcile.error })}</div>
  </div>
{:else}
  <DataGrid
    value={reconcile.rows}
    onChange={reconcile.handleChange}
    {editable}
    maxColumns={2}
    columnLabels={[i18n.t('properties.key'), i18n.t('properties.value')]}
    showHeaders={false}
    hideHeaderToggle
    initialColumnWidths={['35%', '65%']}
    storageKey="properties-preview" storagePrefix={COLUMN_WIDTH_PREFIX} />
{/if}
