<script lang="ts">
  import { untrack } from 'svelte'
  import { compareGridValues } from '../grid-utils'
  import { createGridSort } from '../use-grid-sort.svelte'
  import type { createGridModel } from '../use-grid-model.svelte'

  interface Props {
    rows: string[][]
    headers?: boolean
  }

  let { rows, headers = true }: Props = $props()

  // A reactive cell matrix backed by the same shape the grid model exposes, so
  // the sort controller reads rows and reorders them exactly like the real
  // model without pulling in the whole grid. The seed reads `rows` once
  // (untrack) because the harness mounts it fresh per test.
  let matrix = $state<string[][]>(untrack(() => rows.map(row => [...row])))

  const model = {
    get rows() {
      return matrix.map((cells, ri) => ({
        id: ri,
        cells: cells.map((value, ci) => ({ id: ri * 100 + ci, value, committed: true })),
      }))
    },
    sortRows(ci: number, direction: 'asc' | 'desc') {
      const start = headers ? 1 : 0
      const data = matrix.slice(start)
      const sorted = [...data].sort((a, b) => {
        const cmp = compareGridValues(a[ci] ?? '', b[ci] ?? '')
        return direction === 'asc' ? cmp : -cmp
      })
      matrix = [...matrix.slice(0, start), ...sorted]
    },
  } as unknown as ReturnType<typeof createGridModel>

  const sort = createGridSort(model)

  function editCell() {
    matrix = matrix.map((row, r) => (r === 1 ? row.map((value, c) => (c === 0 ? 'Zulu' : value)) : row))
  }
</script>

<div data-testid="sort-state">{sort.sortColumn ?? 'none'}:{sort.sortDirection}</div>
<div data-testid="matrix">{JSON.stringify(matrix)}</div>
<button type="button" onclick={() => sort.handleSortClick(0)}>sort-asc</button>
<button type="button" onclick={() => sort.handleSortClick(0, 'desc')}>sort-desc</button>
<button type="button" onclick={editCell}>edit-cell</button>
