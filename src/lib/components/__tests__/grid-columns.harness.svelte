<script lang="ts">
  import { untrack } from 'svelte'
  import { createGridColumns } from '../use-grid-columns.svelte'

  interface Props {
    columnCount: number
    initialColumnWidths?: string[]
  }

  let { columnCount, initialColumnWidths }: Props = $props()

  // The width engine needs a container to measure against; jsdom has no layout,
  // so the test gives `clientWidth` a value on the prototype.
  let container = $state<HTMLElement | null>(null)
  let viewport = $state<HTMLElement | null>(null)
  // The column count lives here so the test can grow the grid the way the real
  // component does (a column inserted while the widths are already managed).
  // The prop seeds it once (untrack) because the harness mounts fresh per test.
  let count = $state(untrack(() => columnCount))

  const columns = createGridColumns({
    getColumnCount: () => count,
    getContainer: () => container,
    getViewport: () => viewport,
    getColumnCellWidth: () => 100,
    getInitialColumnWidths: () => initialColumnWidths,
    getStorageKey: () => undefined,
  })
</script>

<div bind:this={container} data-testid="container"></div>
<div bind:this={viewport} data-testid="viewport"></div>
<button type="button" data-testid="add-column" onclick={() => (count += 1)}>add-column</button>
<div data-testid="widths">{JSON.stringify(columns.renderedColumnWidths)}</div>
<div data-testid="managed">{columns.managedWidths ? 'managed' : 'auto'}</div>
<div data-testid="total">{columns.totalWidth}</div>
<div data-testid="style-0">{columns.columnWidthStyle(0)}</div>
