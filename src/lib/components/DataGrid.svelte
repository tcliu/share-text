<script lang="ts">
  import { tick } from 'svelte'
  import Button from './Button.svelte'
  import { createGridModel } from './use-grid-model.svelte'
  import { createGridSelection, createInitialSelectionState } from './use-grid-selection.svelte'
  import { createGridClipboard } from './use-grid-clipboard'
  import { createAutoScroll } from './use-grid-autoscroll.svelte'
  import { columnLetter } from './grid-utils'

  interface Props {
    value?: string[][]
    onChange?: (rows: string[][]) => void
    showHeaders?: boolean
    testId?: string
  }

  let { value = [], onChange, showHeaders = $bindable(true), testId = 'data-grid' }: Props = $props()

  const model = createGridModel({
    getValue: () => value,
    getHeaders: () => showHeaders,
    onChange: (m) => onChange?.(m),
  })

  let gridContainer: HTMLElement | null = null
  let editSnapshot: { ri: number; ci: number; value: string } = { ri: -1, ci: -1, value: '' }

  function cellInputEl(ri: number, ci: number): HTMLInputElement | null {
    return gridContainer?.querySelector<HTMLInputElement>(`input[data-row="${ri}"][data-col="${ci}"]`) ?? null
  }

  const focus = {
    cellBox(ri: number, ci: number) { cellInputEl(ri, ci)?.closest<HTMLElement>('td, th')?.focus() },
    cellInput(ri: number, ci: number) { cellInputEl(ri, ci)?.focus() },
    cellInputAtEnd(ri: number, ci: number) {
      tick().then(() => {
        const input = cellInputEl(ri, ci)
        if (input) {
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
      })
    },
    startEdit(ri: number, ci: number, value: string) {
      model.setValue(ri, ci, value)
      cellInputEl(ri, ci)?.focus()
    },
    rowSelector(ri: number) { gridContainer?.querySelector<HTMLElement>(`[data-row-selector="${ri}"]`)?.focus() },
    columnSelector(ci: number) { gridContainer?.querySelector<HTMLElement>(`[data-col-selector="${ci}"]`)?.focus() },
    isCellInputFocused(ri: number, ci: number) { return document.activeElement === cellInputEl(ri, ci) },
  }

  const clipboard = createGridClipboard()
  const selState = $state(createInitialSelectionState())
  const sel = createGridSelection({ model, focus, clipboard, state: selState })

  let historyState = $state({ canUndo: false, canRedo: false })
  $effect(() => {
    return model.onHistory(state => {
      historyState = state
    })
  })

  function restoreFocusAfterHistoryChange() {
    const cell = sel.selectedCell
    tick().then(() => {
      if (cell && model.rows[cell.ri]?.cells[cell.ci]) focus.cellBox(cell.ri, cell.ci)
    })
  }

  function handleHistoryKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) model.redo()
      else model.undo()
      restoreFocusAfterHistoryChange()
    } else if (key === 'y') {
      event.preventDefault()
      model.redo()
      restoreFocusAfterHistoryChange()
    }
  }
  const autoScroll = createAutoScroll({
    getContainer: () => gridContainer,
    isDragging: sel.isDragging,
    onCellHover: (ri, ci) => sel.handleCellMouseOver(ri, ci),
    onRowHover: (ri) => sel.handleRowSelectorMouseOver(ri),
    onColHover: (ci) => sel.handleColumnSelectorMouseOver(ci),
  })

  $effect(() => () => autoScroll.stop())

  function handleWindowMouseUp() {
    sel.endDrag()
    autoScroll.stop()
  }

  function handleInputFocus(ri: number, ci: number) {
    const value = model.rows[ri]?.cells[ci]?.value ?? ''
    editSnapshot = { ri, ci, value }
    sel.setActiveCell(ri, ci)
  }

  function handleInputKeydown(event: KeyboardEvent, ri: number, ci: number) {
    if (event.key === 'Tab' && !event.shiftKey) {
      if (ci < model.columnCount - 1) {
        focus.cellInput(ri, ci + 1)
        return
      } else if (ri < model.rowCount - 1) {
        event.preventDefault()
        tick().then(() => focus.cellInput(ri + 1, 0))
        return
      }
    } else if (event.key === 'Tab' && event.shiftKey) {
      if (ci > 0) {
        focus.cellInput(ri, ci - 1)
        return
      } else if (ri > 0) {
        event.preventDefault()
        tick().then(() => focus.cellInput(ri - 1, model.columnCount - 1))
        return
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const nextRi = Math.min(model.rowCount - 1, ri + 1)
      sel.setActiveCell(nextRi, ci)
      ;(event.target as HTMLInputElement).blur()
      tick().then(() => focus.cellBox(nextRi, ci))
    } else if (event.key === 'Escape') {
      event.preventDefault()
      const cell = model.rows[ri]?.cells[ci]
      if (cell && editSnapshot.ri === ri && editSnapshot.ci === ci) {
        cell.value = editSnapshot.value
      }
      ;(event.target as HTMLInputElement).blur()
      if (model.rows[ri]) {
        tick().then(() => focus.cellBox(ri, ci))
      }
    }
  }

  function handleBoxPaste(event: ClipboardEvent, ri: number, ci: number) {
    if (event.target !== event.currentTarget) return
    const text = event.clipboardData?.getData('text') ?? ''
    if (!text) return
    event.preventDefault()
    const cell = model.rows[ri]?.cells[ci]
    if (!cell) return
    model.setValue(ri, ci, text)
    sel.setActiveCell(ri, ci)
    focus.cellInput(ri, ci)
  }

  function handleBodyBlur() {
    model.flushCommit()
  }

  function handleTrim() {
    sel.trimSelected()
  }
</script>

<svelte:window onmouseup={handleWindowMouseUp} onmousemove={autoScroll.onWindowMouseMove} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div data-testid={testId} onkeydown={handleHistoryKeydown} class="flex h-full flex-col gap-2 bg-slate-950 p-2 text-slate-200">
  <div class="flex flex-none flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-1">
      <Button size="sm" ariaLabel="Toggle header" tooltip="Toggle header" onClick={() => (showHeaders = !showHeaders)}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 8h14" />
            <path d="M8 8v9" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Insert row above"
        tooltip="Insert row above"
        onClick={() => sel.insertRowAt(sel.actionRow, false)}
        disabled={sel.rowInsertDisabled}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 7h14" />
            <path d="M10 3v4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Insert row below"
        tooltip="Insert row below"
        onClick={() => (sel.noSelection ? sel.addRow() : sel.insertRowAt(sel.actionRow, true))}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 13h14" />
            <path d="M10 13v4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Insert column before"
        tooltip="Insert column before"
        onClick={() => sel.insertColumnAt(sel.actionCol, true)}
        disabled={selState.selectedCols.size === 0}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M7 3v14" />
            <path d="M3 10h4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Insert column after"
        tooltip="Insert column after"
        onClick={() => (sel.noSelection ? sel.addColumn() : sel.insertColumnAt(sel.actionCol + 1, true))}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M13 3v14" />
            <path d="M13 10h4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Delete rows"
        tooltip="Delete rows"
        onClick={() => sel.deleteSelectedRows()}
        disabled={selState.selectedRows.size === 0}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M4 6h12" />
            <path d="M8 6V4h4v2" />
            <path d="M6 6l.7 10h6.6L14 6" />
            <path d="M9 9v4M11 9v4" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Delete columns"
        tooltip="Delete columns"
        onClick={() => sel.deleteSelectedColumns()}
        disabled={selState.selectedCols.size === 0}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M5 3h2l1-1l2-1h2l2 1 1 1h2" />
            <path d="M6 5l1 12h6l1-12" />
            <path d="M9 8v6M11 8v6" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Remove empty trailing rows/columns"
        tooltip="Remove empty trailing rows/columns"
        onClick={handleTrim}
        disabled={!model.needsTrim}>
        {#snippet icon()}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M3 8h14M8 3v14" />
            <path d="M9 10h4" />
            <path d="M12 8l2 2-2 2" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Undo"
        tooltip="Undo (Ctrl+Z)"
        onClick={() => {
          model.undo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={!historyState.canUndo}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        {/snippet}
      </Button>
      <Button
        size="sm"
        ariaLabel="Redo"
        tooltip="Redo (Ctrl+Shift+Z)"
        onClick={() => {
          model.redo()
          restoreFocusAfterHistoryChange()
        }}
        disabled={!historyState.canRedo}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        {/snippet}
      </Button>
    </div>
    <span class="text-xs text-slate-500">{model.rowCount} rows · {model.columnCount} columns</span>
  </div>

  <div class="min-h-0 flex-1 overflow-auto rounded-md" bind:this={gridContainer}>
    <table class="w-full border-separate border-spacing-0 border-t border-l border-slate-800 text-sm">
      {#if model.rowCount > 0}
        <thead>
          <tr class="sticky top-0 z-20 bg-slate-900">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <th
              class="sticky left-0 top-0 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
              data-select-all
              tabindex="-1"
              onmousedown={sel.handleSelectAllMousedown}
              onkeydown={sel.handleSelectAllKeydown}></th>
            {#each Array.from({ length: model.columnCount }) as _, ci}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <th
                class={sel.columnSelectorClass(ci)}
                data-col-selector={ci}
                tabindex="-1"
                onmousedown={event => sel.handleColumnSelectorMousedown(event, ci)}
                onmouseenter={() => sel.handleColumnSelectorMouseOver(ci)}
                onkeydown={event => sel.handleColumnSelectorKeydown(event, ci)}>
                {columnLetter(ci)}
              </th>
            {/each}
          </tr>
          {#if showHeaders && model.rowCount > 0}
            <tr class="sticky top-6 z-20 bg-slate-900">
              <th
                class="sticky left-0 top-6 z-30 w-9 border-b border-r border-b-slate-600 border-r-slate-500 bg-slate-900 p-0 text-center font-normal"
              ></th>
              {#each model.rows[0].cells as cell, ci (cell.id)}
                <th
                  class={sel.cellClass(
                    'min-w-32 border-b border-r border-b-slate-600 border-r-slate-800 p-0 font-semibold outline-none',
                    0,
                    ci,
                  )}
                  style={sel.rangeHighlightStyle(0, ci)}
                  tabindex="-1"
                  onmousedown={event => sel.handleCellMousedown(event, 0, ci)}
                  onmouseenter={() => sel.handleCellMouseOver(0, ci)}
                  onkeydown={event => sel.handleBoxKeydown(event, 0, ci)}
                  onpaste={event => handleBoxPaste(event, 0, ci)}>
                  <input
                    data-row={0}
                    data-col={ci}
                    class="w-full border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-inset focus:ring-cyan-500/70"
                    value={cell.value}
                    oninput={event => model.setValue(0, ci, event.currentTarget.value)}
                    onfocus={() => {
                      handleInputFocus(0, ci)
                      focus.cellInputAtEnd(0, ci)
                    }}
                    onblur={() => handleBodyBlur()}
                    onkeydown={event => handleInputKeydown(event, 0, ci)} />
                </th>
              {/each}
            </tr>
          {/if}
        </thead>
        <tbody>
          {#each showHeaders ? model.rows.slice(1) : model.rows as row, ri (row.id)}
            {@const actualRi = showHeaders ? ri + 1 : ri}
            <tr class={sel.trClass(actualRi)}>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <td
                class={sel.rowSelectorClass(actualRi)}
                data-row-selector={actualRi}
                tabindex="-1"
                onmousedown={event => sel.handleRowSelectorMousedown(event, actualRi)}
                onmouseenter={() => sel.handleRowSelectorMouseOver(actualRi)}
                onkeydown={event => sel.handleRowSelectorKeydown(event, actualRi)}>
                <span class="px-1.5 text-xs text-slate-500">{ri + 1}</span>
              </td>
              {#each row.cells as cell, ci (cell.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <td
                  class={sel.cellClass(
                    'min-w-32 border-b border-r border-slate-800 p-0 outline-none',
                    actualRi,
                    ci,
                  )}
                  style={sel.rangeHighlightStyle(actualRi, ci)}
                  tabindex="-1"
                  onmousedown={event => sel.handleCellMousedown(event, actualRi, ci)}
                  onmouseenter={() => sel.handleCellMouseOver(actualRi, ci)}
                  onkeydown={event => sel.handleBoxKeydown(event, actualRi, ci)}
                  onpaste={event => handleBoxPaste(event, actualRi, ci)}>
                  <input
                    data-row={actualRi}
                    data-col={ci}
                    class="w-full border-0 bg-transparent px-2 py-1 text-slate-200 outline-none focus:bg-slate-800 focus:ring-1 focus:ring-inset focus:ring-cyan-500/70"
                    value={cell.value}
                    oninput={event => model.setValue(actualRi, ci, event.currentTarget.value)}
                    onfocus={() => handleInputFocus(actualRi, ci)}
                    onblur={() => handleBodyBlur()}
                    onkeydown={event => handleInputKeydown(event, actualRi, ci)} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      {/if}
    </table>

    {#if model.rowCount === 0}
      <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <span>No content to preview</span>
        <button class="rounded border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800" onclick={() => sel.addRow()}>
          Add row
        </button>
      </div>
    {/if}
  </div>
</div>
