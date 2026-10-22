<script module lang="ts">
  import { FONT_RATIO, type SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  import { iconOnlyBoxPx } from './Button.svelte'

  // Row class split: the structural base is fixed (icon reveal rides `group`,
  // layout and highlight sizing ride the rest), while the tunable slot carries
  // gaps, padding, rounding, and highlight. A custom `containerRowClass` or
  // `leafRowClass` replaces only its tunable default, so gap overrides never
  // fight a leftover utility and structural classes cannot be dropped. The
  // showcase page seeds its class rows from the tunable defaults.
  export const STRUCTURE_ROW_BASE_CLASS = 'group flex w-fit max-w-full items-center'
  export const DEFAULT_CONTAINER_ROW_CLASS = 'gap-2 rounded py-1 hover:bg-slate-800/40'
  export const DEFAULT_LEAF_ROW_CLASS = 'gap-1 rounded py-1 hover:bg-slate-800/40'

  // Size scale, calibrated at the `md` default so the tree renders exactly as
  // before (14px text on a 19.25px line = `text-sm leading-snug`) and scales
  // continuously: the row text rides the dimension's font ratio, and the caret
  // and action buttons ride the ratios that reproduce the `xs`/`sm` steps at
  // `md` so the row stays proportionate at every size.
  const LEADING_SNUG = 1.375
  export const STRUCTURE_RATIOS = { font: FONT_RATIO, line: FONT_RATIO * LEADING_SNUG, caret: 0.75, action: 0.875 }

  // The mono text classes every tree surface shares; the `--tree-*` vars come
  // from `structureStyle` on the owning root.
  export const STRUCTURE_TEXT_CLASS = 'font-mono text-[length:var(--tree-font)] leading-[var(--tree-line)]'

  // Difference between the two default row gaps: container `gap-2` (8px) minus
  // leaf `gap-1` (4px). Calibrated to the built-in row classes.
  const GAP_STEP_PX = 4

  export function structureMetrics(size: SizeInput) {
    return dimensionMetrics(size, STRUCTURE_RATIOS)
  }

  export function structureStyle(size: SizeInput): string {
    const metrics = structureMetrics(size)
    // The leaf gutter stands in for the container's caret column: the caret
    // button's own box plus the gap difference above, so a leaf key starts at
    // the same x as a container label at the same level even when some props
    // are nested containers.
    const gutter = iconOnlyBoxPx(metrics.caret) + GAP_STEP_PX
    return `${sizeVarStyle('tree', metrics)};--tree-gutter:${gutter}px`
  }
</script>

<script lang="ts">
  import { copyToClipboard } from './copy-to-clipboard'
  import Self from './StructureNode.svelte'
  import Button from './Button.svelte'
  import Copyable from './Copyable.svelte'
  import FormDialog from './FormDialog.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import Tooltip from './Tooltip.svelte'
  import CaretRightIcon from '$lib/icons/CaretRightIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import CopyIcon from '$lib/icons/CopyIcon.svelte'
  import {
    type StructureEntry,
    childEntries,
    containerSummary,
    copyValue,
    inputText,
    isContainer,
    jsonPath,
    parseInputValue,
    valueClass,
    valueText,
  } from './structure-value'
  import { createInlineEdit } from './use-structure-inline-edit.svelte'
  import { createStructureObjectEditor } from './use-structure-object-editor.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    label: string
    value: object | unknown[]
    depth?: number
    path?: string[]
    onChange?: (path: string[], newValue: unknown) => void
    onRenameKey?: (parentPath: string[], oldKey: string, newKey: string) => void
    editable?: boolean
    /** True when the parent container is an array: index labels cannot rename. */
    parentIsArray?: boolean
    /** Replaces the tunable container header row classes (gaps, padding, highlight). */
    containerRowClass?: string
    /** Replaces the tunable leaf row classes (gaps, padding, highlight). */
    leafRowClass?: string
    /** Control scale; the text and the row's inner controls follow it. */
    size?: SizeInput
  }

  let {
    label,
    value,
    depth = 0,
    path = [],
    onChange,
    onRenameKey,
    editable = true,
    parentIsArray = false,
    containerRowClass,
    leafRowClass,
    size = 'md',
  }: Props = $props()

  const treeMetrics = $derived(structureMetrics(size))
  const treeStyle = $derived(structureStyle(size))

  // One-shot openness from the static depth: a derived default keeps the
  // toggle override without reading a prop inside a `$state` initializer.
  let openOverride = $state<boolean | null>(null)
  const open = $derived(openOverride ?? depth === 0)

  const entries = $derived(childEntries(value))

  // Value edit, key rename, and own-label rename share one measured inline
  // field; the commit and keydown logic below interprets each field's text.
  const editValue = createInlineEdit<string>()
  const editName = createInlineEdit<string>()
  const editOwnName = createInlineEdit<boolean>()

  let measureEl = $state<HTMLSpanElement | null>(null)

  // Owned object-edit dialog lifecycle. The seed/draft are set on open and the
  // parsed document only commits on OK, so cancelling never touches live state.
  const objectEditor = createStructureObjectEditor({
    getValue: () => value,
    getPath: () => path,
    getOnChange: () => onChange,
  })

  // Each field is sized to its displayed text, so the field occupies exactly
  // that text's box and the rest of the row keeps its position; the field edits
  // the raw text (a string value's quotes are display-only).
  function startEditValue(entry: StructureEntry) {
    editValue.begin(entry.key, inputText(entry.value), measureText(valueText(entry.value)))
  }

  function startEditName(entry: StructureEntry) {
    editName.begin(entry.key, entry.key, measureText(entry.key))
  }

  function startEditOwnName() {
    editOwnName.begin(true, label, measureText(label))
  }

  function measureText(text: string): number {
    if (!measureEl) return 0
    measureEl.textContent = text
    const width = measureEl.getBoundingClientRect().width
    // The span is visually hidden but still in the DOM text; clear it once
    // measured so it never leaks into textContent assertions or copying.
    measureEl.textContent = ''
    return width
  }

  async function handleCopy(text: string) {
    await copyToClipboard(text, {
      copied: i18n.t('editor.toast.copied'),
      failed: i18n.t('editor.toast.copyFailed'),
    })
  }

  function commitValue() {
    const key = editValue.key
    if (key === null || !onChange) {
      editValue.cancel()
      return
    }
    const entry = entries.find(e => e.key === key)
    if (!entry) {
      editValue.cancel()
      return
    }
    const next = parseInputValue(editValue.text)
    if (next === entry.value) {
      editValue.cancel()
      return
    }
    onChange([...path, key], next)
    editValue.cancel()
  }

  function commitName() {
    const key = editName.key
    if (key === null || !onRenameKey) {
      editName.cancel()
      return
    }
    const entry = entries.find(e => e.key === key)
    if (!entry) {
      editName.cancel()
      return
    }
    const next = editName.text.trim()
    if (!next || next === key) {
      editName.cancel()
      return
    }
    onRenameKey(path, key, next)
    editName.cancel()
  }

  function commitOwnName() {
    if (!onRenameKey) {
      editOwnName.cancel()
      return
    }
    const next = editOwnName.text.trim()
    if (next && next !== label) {
      onRenameKey(path.slice(0, -1), label, next)
    }
    editOwnName.cancel()
  }

  function handleValueKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitValue()
    } else if (event.key === 'Escape') {
      editValue.cancel()
    }
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitName()
    } else if (event.key === 'Escape') {
      editName.cancel()
    }
  }

  function handleOwnNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitOwnName()
    } else if (event.key === 'Escape') {
      editOwnName.cancel()
    }
  }

  function entryPath(entry: StructureEntry): string[] {
    return [...path, entry.key]
  }

  const nodeJsonPath = $derived(jsonPath(path))
</script>

<span
  bind:this={measureEl}
  class="invisible absolute font-mono text-[length:var(--tree-font)] leading-[var(--tree-line)] whitespace-pre"
  style={treeStyle}
  aria-hidden="true"></span>

<!-- One row-action cluster, shared by every row so the edit and copy glyphs sit
  a fixed small gap apart with a common vertical center, and so a row keeps its
  height (set by the buttons) while a field is being edited. -->
{#snippet rowActions(name: string, copyText: string, onEdit?: () => void)}
  <span
    class="flex shrink-0 items-center gap-0.5 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:opacity-0">
    {#if onEdit}
      <Button
        size={treeMetrics.action}
        variant="ghost"
        ariaLabel={i18n.t('structure.editKey', { name })}
        tooltip={i18n.t('structure.editKey', { name })}
        onClick={e => {
          e.stopPropagation()
          onEdit()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        }}
        className="bg-transparent p-1.5 text-slate-400 hover:text-cyan-300">
        {#snippet icon()}
          <EditIcon />
        {/snippet}
      </Button>
    {/if}
    <Button
      size={treeMetrics.action}
      variant="ghost"
      ariaLabel={i18n.t('structure.copyValue', { name })}
      tooltip={i18n.t('structure.copyValue', { name })}
      onClick={e => {
        e.stopPropagation()
        void handleCopy(copyText)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
      }}
      className="bg-transparent p-1.5 text-slate-400 hover:text-cyan-300">
      {#snippet icon()}
        <CopyIcon />
      {/snippet}
    </Button>
  </span>
{/snippet}

<div class={STRUCTURE_TEXT_CLASS} style={treeStyle}>
  <div class={`${STRUCTURE_ROW_BASE_CLASS} ${containerRowClass || DEFAULT_CONTAINER_ROW_CLASS}`}>
    <Button
      size={treeMetrics.caret}
      variant="ghost"
      ariaLabel={open ? i18n.t('structure.collapse', { name: label }) : i18n.t('structure.expand', { name: label })}
      ariaExpanded={open}
      onClick={() => (openOverride = !open)}
      className="shrink-0">
      {#snippet icon()}
        <CaretRightIcon className="text-slate-400 transition-transform {open ? 'rotate-90' : ''}" />
      {/snippet}
    </Button>
    <span class={editOwnName.key ? 'min-w-0' : 'min-w-0 truncate'}>
      {#if label !== ''}
        {#if editOwnName.key && onRenameKey && editable}
          <input
            bind:this={editOwnName.input}
            bind:value={editOwnName.text}
            class="min-w-[2ch] rounded-[1px] bg-slate-900 p-0 font-mono text-[length:var(--tree-font)] leading-[var(--tree-line)] text-slate-300 outline outline-1 outline-cyan-500 outline-offset-[6px]"
            style={`width: ${editOwnName.width}px`}
            onblur={commitOwnName}
            onmousedown={e => {
              if (editOwnName.isEntryPress(e)) {
                e.preventDefault()
                editOwnName.caretToEnd()
              }
            }}
            ondblclick={e => {
              if (editOwnName.isEntryPress(e)) {
                e.preventDefault()
                editOwnName.caretToEnd()
              }
            }}
            onkeydown={handleOwnNameKeydown} />
        {:else if onRenameKey && editable && path.length > 0 && !parentIsArray}
          <span
            class="cursor-pointer rounded text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-500"
            ondblclick={e => {
              e.stopPropagation()
              startEditOwnName()
            }}
            onkeydown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                startEditOwnName()
              }
            }}
            role="button"
            tabindex="0">{label}<Tooltip>{i18n.t('structure.renameHint')}</Tooltip></span>
        {:else}
          <span class="text-slate-300">{label}</span>
        {/if}
        <span class="text-slate-600">:</span>
      {/if}
      <span class="text-slate-400">{containerSummary(value)}</span>
    </span>
    {@render rowActions(nodeJsonPath, copyValue(value), onChange && editable ? () => objectEditor.openEditor() : undefined)}
  </div>

  {#if open}
    <div class={depth === 0 ? 'ml-[0.3rem] pl-2' : 'ml-[0.3rem] border-l border-slate-800 pl-2'}>
      {#each entries as entry (entry.key)}
        {#if isContainer(entry.value)}
          <Self
            label={entry.key}
            value={entry.value as object | unknown[]}
            depth={depth + 1}
            path={entryPath(entry)}
            {onChange}
            {onRenameKey}
            {editable}
            {containerRowClass}
            {leafRowClass}
            {size}
            parentIsArray={Array.isArray(value)} />
        {:else if editValue.key === entry.key && onChange && editable}
          <div class={`${STRUCTURE_ROW_BASE_CLASS} ${leafRowClass || DEFAULT_LEAF_ROW_CLASS}`}>
            <span class="w-[var(--tree-gutter)] shrink-0 max-phone:w-12"></span>
            <span class="shrink-0 text-slate-300">{entry.key}</span>
            <span class="shrink-0 text-slate-600">:</span>
            <div class="flex-1">
              <input
                bind:this={editValue.input}
                bind:value={editValue.text}
                class="ml-1.5 min-w-[2ch] shrink-0 rounded-[1px] bg-slate-900 p-0 font-mono text-[length:var(--tree-font)] leading-[var(--tree-line)] outline outline-1 outline-cyan-500 outline-offset-[6px]"
                style={`width: ${editValue.width}px`}
                onblur={commitValue}
                onmousedown={e => {
                  // The gesture that opened the field must not select and flash a
                  // selection before the caret is re-placed; a later double-click
                  // is left alone so it selects the text.
                  if (editValue.isEntryPress(e)) {
                    e.preventDefault()
                    editValue.caretToEnd()
                  }
                }}
                ondblclick={e => {
                  if (editValue.isEntryPress(e)) {
                    e.preventDefault()
                    editValue.caretToEnd()
                  }
                }}
                onkeydown={handleValueKeydown} />
            </div>
            {@render rowActions(jsonPath(entryPath(entry)), copyValue(entry.value))}
          </div>
        {:else if editName.key === entry.key && onRenameKey && editable}
          <div class={`${STRUCTURE_ROW_BASE_CLASS} ${leafRowClass || DEFAULT_LEAF_ROW_CLASS}`}>
            <span class="w-[var(--tree-gutter)] shrink-0 max-phone:w-12"></span>
            <input
              bind:this={editName.input}
              bind:value={editName.text}
              class="min-w-[2ch] shrink-0 rounded-[1px] bg-slate-900 p-0 font-mono text-[length:var(--tree-font)] leading-[var(--tree-line)] text-slate-300 outline outline-1 outline-cyan-500 outline-offset-[6px]"
              style={`width: ${editName.width}px`}
              onblur={commitName}
              onmousedown={e => {
                if (editName.isEntryPress(e)) {
                  e.preventDefault()
                  editName.caretToEnd()
                }
              }}
              ondblclick={e => {
                if (editName.isEntryPress(e)) {
                  e.preventDefault()
                  editName.caretToEnd()
                }
              }}
              onkeydown={handleNameKeydown} />
            <span class="shrink-0 text-slate-600">:</span>
            <span class={`ml-1.5 ${valueClass(entry.value)}`}>{valueText(entry.value)}</span>
            {@render rowActions(jsonPath(entryPath(entry)), copyValue(entry.value))}
          </div>
        {:else}
          <div class={`${STRUCTURE_ROW_BASE_CLASS} ${leafRowClass || DEFAULT_LEAF_ROW_CLASS}`}>
            <span class="w-[var(--tree-gutter)] shrink-0 max-phone:w-12"></span>
            {#if onRenameKey && editable}
              <span
                class="shrink-0 cursor-pointer rounded text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-500"
                ondblclick={e => {
                  e.stopPropagation()
                  startEditName(entry)
                }}
                onkeydown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    startEditName(entry)
                  }
                }}
                role="button"
                tabindex="0">{entry.key}<Tooltip>{i18n.t('structure.renameHint')}</Tooltip></span>
            {:else}
              <span class="shrink-0 text-slate-300">{entry.key}</span>
            {/if}
            <span class="shrink-0 text-slate-600">:</span>
            {#if onChange && editable}
              <!-- The hint rides the value button itself; keep the Tooltip flush
                against the value span (no whitespace between them) so it adds no
                space to the row's inline text. -->
              <button
                type="button"
                class="ml-1.5 min-w-0 cursor-pointer truncate rounded bg-transparent text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-500"
                onclick={() => startEditValue(entry)}
                ondblclick={() => startEditValue(entry)}>
                <span class={valueClass(entry.value)}>{valueText(entry.value)}</span><Tooltip>{i18n.t('structure.editKey', { name: jsonPath(entryPath(entry)) })}</Tooltip>
              </button>
            {:else}
              <span class="ml-1.5 min-w-0 truncate text-slate-400">
                <span class={valueClass(entry.value)}>{valueText(entry.value)}</span>
              </span>
            {/if}
            {@render rowActions(jsonPath(entryPath(entry)), copyValue(entry.value), onChange && editable ? () => startEditValue(entry) : undefined)}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#snippet objectActions()}
    <Button variant="outline" type="button" disabled={!objectEditor.valid} onClick={objectEditor.format}>
      {i18n.t('structure.format')}
    </Button>
  {/snippet}

  {#snippet objectTitle()}
    <Copyable text={nodeJsonPath} textClass="text-slate-100">
      <span>{nodeJsonPath}</span>
    </Copyable>
  {/snippet}

  {#if objectEditor.open}
    <FormDialog
      header={objectTitle}
      widthVariant="3xl"
      closeLabel={i18n.t('common.close')}
      saveLabel={i18n.t('common.ok')}
      resetLabel={i18n.t('common.reset')}
      discardTitle={i18n.t('common.discardTitle')}
      discardMessage={i18n.t('common.discardMessage')}
      discardLabel={i18n.t('common.discard')}
      confirmOnDismiss
      dirty={objectEditor.dirty}
      saveDisabled={!objectEditor.valid}
      onSave={objectEditor.save}
      onReset={objectEditor.reset}
      onClose={objectEditor.close}
      actions={objectActions}>
      <div class="flex min-h-0 flex-col gap-3">
        <LazyCodeEditor
          bind:content={objectEditor.draft}
          docType="json"
          editorAriaLabel={nodeJsonPath}
          containerClass="h-96 overflow-hidden rounded-md border border-slate-700 bg-slate-950"
          editorClass="h-full" />
        {#if !objectEditor.valid}
          <p role="alert" class="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {i18n.t('common.invalidJson')}
          </p>
        {/if}
      </div>
    </FormDialog>
  {/if}
</div>
