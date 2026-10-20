<script lang="ts">
  import Button from './Button.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import type { createGridModel, HistoryState } from './use-grid-model.svelte'
  import type { createGridSelection } from './use-grid-selection.svelte'
  import TableIcon from '$lib/icons/TableIcon.svelte'
  import RowInsertAboveIcon from '$lib/icons/RowInsertAboveIcon.svelte'
  import RowInsertBelowIcon from '$lib/icons/RowInsertBelowIcon.svelte'
  import ColumnInsertBeforeIcon from '$lib/icons/ColumnInsertBeforeIcon.svelte'
  import ColumnInsertAfterIcon from '$lib/icons/ColumnInsertAfterIcon.svelte'
  import DeleteRowsIcon from '$lib/icons/DeleteRowsIcon.svelte'
  import DeleteColumnsIcon from '$lib/icons/DeleteColumnsIcon.svelte'
  import TrimIcon from '$lib/icons/TrimIcon.svelte'
  import UndoIcon from '$lib/icons/UndoIcon.svelte'
  import RedoIcon from '$lib/icons/RedoIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    size?: SizeInput
    model: ReturnType<typeof createGridModel>
    sel: ReturnType<typeof createGridSelection>
    showHeaders: boolean
    onToggleHeaders: () => void
    editable: boolean
    hideHeaderToggle: boolean
    maxColumns?: number
    historyState: HistoryState
    onTrim: () => void
    onUndo: () => void
    onRedo: () => void
  }

  let {
    size = 'md',
    model,
    sel,
    showHeaders,
    onToggleHeaders,
    editable,
    hideHeaderToggle,
    maxColumns,
    historyState,
    onTrim,
    onUndo,
    onRedo,
  }: Props = $props()

  function mutationDisabled(disabled = false): boolean {
    return !editable || disabled
  }
</script>

<div class="flex flex-none flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap items-center gap-1">
    {#if !hideHeaderToggle}
      <Button
        {size}
        ariaLabel={i18n.t('grid.toggleHeader')}
        tooltip={i18n.t('grid.toggleHeader')}
        ariaPressed={showHeaders}
        onClick={onToggleHeaders}
        disabled={!editable}>
        {#snippet icon()}
          <TableIcon />
        {/snippet}
      </Button>
    {/if}
    <Button
      {size}
      ariaLabel={i18n.t('grid.insertRowAbove')}
      tooltip={i18n.t('grid.insertRowAbove')}
      onClick={() => sel.insertRowAt(sel.actionRow, false)}
      disabled={mutationDisabled(sel.rowInsertDisabled)}>
      {#snippet icon()}
        <RowInsertAboveIcon />
      {/snippet}
    </Button>
    <Button
      {size}
      ariaLabel={i18n.t('grid.insertRowBelow')}
      tooltip={i18n.t('grid.insertRowBelow')}
      onClick={() => (sel.noSelection ? sel.addRow() : sel.insertRowAt(sel.actionRow, true))}
      disabled={!editable}>
      {#snippet icon()}
        <RowInsertBelowIcon />
      {/snippet}
    </Button>
    {#if maxColumns == null}
      <Button
        {size}
        ariaLabel={i18n.t('grid.insertColumnBefore')}
        tooltip={i18n.t('grid.insertColumnBefore')}
        onClick={() => sel.insertColumnAt(sel.actionCol, true)}
        disabled={mutationDisabled(sel.colInsertDisabled)}>
        {#snippet icon()}
          <ColumnInsertBeforeIcon />
        {/snippet}
      </Button>
      <Button
        {size}
        ariaLabel={i18n.t('grid.insertColumnAfter')}
        tooltip={i18n.t('grid.insertColumnAfter')}
        onClick={() => (sel.noSelection ? sel.addColumn() : sel.insertColumnAt(sel.actionCol + 1, true))}
        disabled={!editable}>
        {#snippet icon()}
          <ColumnInsertAfterIcon />
        {/snippet}
      </Button>
    {/if}
    <Button
      {size}
      ariaLabel={i18n.t('grid.deleteRows')}
      tooltip={i18n.t('grid.deleteRows')}
      onClick={() => sel.deleteSelectedRows()}
      disabled={mutationDisabled(sel.selectedRows.size === 0)}>
      {#snippet icon()}
        <DeleteRowsIcon />
      {/snippet}
    </Button>
    {#if maxColumns == null}
      <Button
        {size}
        ariaLabel={i18n.t('grid.deleteColumns')}
        tooltip={i18n.t('grid.deleteColumns')}
        onClick={() => sel.deleteSelectedColumns()}
        disabled={mutationDisabled(sel.selectedCols.size === 0)}>
        {#snippet icon()}
          <DeleteColumnsIcon />
        {/snippet}
      </Button>
    {/if}
    <Button
      {size}
      ariaLabel={i18n.t('grid.trimTrailing')}
      tooltip={i18n.t('grid.trimTrailing')}
      onClick={onTrim}
      disabled={mutationDisabled(!model.needsTrim)}>
      {#snippet icon()}
        <TrimIcon />
      {/snippet}
    </Button>
    <Button
      {size}
      ariaLabel={i18n.t('grid.undo')}
      tooltip={i18n.t('grid.undo')}
      onClick={onUndo}
      disabled={mutationDisabled(!historyState.canUndo)}>
      {#snippet icon()}
        <UndoIcon />
      {/snippet}
    </Button>
    <Button
      {size}
      ariaLabel={i18n.t('grid.redo')}
      tooltip={i18n.t('grid.redo')}
      onClick={onRedo}
      disabled={mutationDisabled(!historyState.canRedo)}>
      {#snippet icon()}
        <RedoIcon />
      {/snippet}
    </Button>
  </div>
  <span class="text-xs text-slate-400"
    >{i18n.t('grid.rowColCount', { rows: model.rowCount, columns: model.columnCount })}</span>
</div>
