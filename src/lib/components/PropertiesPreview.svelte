<script lang="ts">
  import DataGrid from './DataGrid.svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { parseProperties, serializeProperties } from '$lib/document-type-utils'

  let { content, onContentChange }: PreviewProps = $props()

  function parseRows(text: string): { rows: string[][]; error: string | null } {
    const parsed = parseProperties(text)
    if (!parsed.ok) {
      return { rows: [], error: parsed.error ?? 'Invalid properties' }
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

  // content is only captured at init; subsequent changes are reconciled in $effect.
  // svelte-ignore state_referenced_locally
  const initial = parseRows(content)
  let parsedRows = $state<string[][]>(initial.rows)
  let parseError = $state<string | null>(initial.error)
  let suppressSync = false
  // The raw content `parsedRows` was last reconciled against, so each content
  // change is parsed at most once and edits never loop against their own echo.
  let lastContent: string | null = null

  $effect(() => {
    if (content === lastContent) return
    lastContent = content
    if (suppressSync) {
      suppressSync = false
      return
    }
    const roundTripped = serializeRows(parsedRows)
    if (content !== roundTripped) {
      const result = parseRows(content)
      parsedRows = result.rows
      parseError = result.error
    }
  })

  function handleChange(rows: string[][]) {
    parsedRows = rows
    parseError = null
    suppressSync = true
    onContentChange?.(serializeRows(rows))
  }
</script>

{#if parseError}
  <div data-testid="properties-preview" class="h-full overflow-auto p-4 text-slate-300">
    <div class="text-sm text-red-400">Unable to parse: {parseError}</div>
  </div>
{:else}
  <DataGrid
    value={parsedRows}
    onChange={handleChange}
    maxColumns={2}
    columnLabels={['Key', 'Value']}
    showHeaders={false}
    hideHeaderToggle
    initialColumnWidths={['35%', '65%']}
    storageKey="properties-preview"
    testId="properties-preview" />
{/if}