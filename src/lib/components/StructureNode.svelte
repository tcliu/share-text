<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Self from './StructureNode.svelte'
  import Copyable from './Copyable.svelte'
  import Button from './Button.svelte'
  import ChevronRightSmallIcon from '$lib/icons/ChevronRightSmallIcon.svelte'
  import EditIcon from '$lib/icons/EditIcon.svelte'
  import CopyIcon from '$lib/icons/CopyIcon.svelte'
  import {
    type StructureEntry,
    childEntries,
    containerSummary,
    copyValue,
    inputText,
    isContainer,
    parseInputValue,
    valueClass,
    valueText,
  } from './structure-value'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    label: string
    value: object | unknown[]
    depth?: number
    path?: string[]
    onChange?: (path: string[], newValue: unknown) => void
    onRenameKey?: (parentPath: string[], oldKey: string, newKey: string) => void
  }

  let {
    label,
    value,
    depth = 0,
    path = [],
    onChange,
    onRenameKey,
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  const startsOpen = depth === 0
  let open = $state(startsOpen)

  const entries = $derived(childEntries(value))

  let editingValueKey = $state<string | null>(null)
  let editValueText = $state('')
  let editValueInput = $state<HTMLInputElement | null>(null)
  let editValueMinWidth = $state(0)

  let editingNameKey = $state<string | null>(null)
  let editNameText = $state('')
  let editNameInput = $state<HTMLInputElement | null>(null)
  let editNameMinWidth = $state(0)

  let measureEl = $state<HTMLSpanElement | null>(null)
  let editBtnEl = $state<HTMLSpanElement | null>(null)
  let editBtnWidth = $state(32)

  $effect(() => {
    if (editBtnEl) {
      editBtnWidth = editBtnEl.getBoundingClientRect().width
    }
  })

  function startEditValue(entry: StructureEntry) {
    const text = inputText(entry.value)
    editValueMinWidth = measureText(text) + editBtnWidth + 4
    editingValueKey = entry.key
    editValueText = text
  }

  function startEditName(entry: StructureEntry) {
    editNameMinWidth = measureText(entry.key) + 8
    editingNameKey = entry.key
    editNameText = entry.key
  }

  function measureText(text: string): number {
    if (!measureEl) return 0
    measureEl.textContent = text
    return measureEl.getBoundingClientRect().width
  }

  $effect(() => {
    if (editingValueKey !== null) {
      editValueInput?.focus()
    }
  })

  $effect(() => {
    if (editingNameKey !== null) {
      editNameInput?.focus()
    }
  })

  $effect(() => {
    if (editingValueKey === null || !editValueInput) return
    void editValueText
    editValueInput.style.width = '0px'
    const contentW = editValueInput.scrollWidth
    editValueInput.style.width = `${Math.max(editValueMinWidth, contentW + 8)}px`
  })

  $effect(() => {
    if (editingNameKey === null || !editNameInput) return
    void editNameText
    editNameInput.style.width = '0px'
    const contentW = editNameInput.scrollWidth
    editNameInput.style.width = `${Math.max(editNameMinWidth, contentW + 8)}px`
  })

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('editor.toast.copied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('editor.toast.copyFailed'))
    }
  }

  function commitValue() {
    if (editingValueKey === null || !onChange) {
      editingValueKey = null
      return
    }
    const entry = entries.find(e => e.key === editingValueKey)
    if (!entry) {
      editingValueKey = null
      return
    }
    const next = parseInputValue(editValueText)
    if (next === entry.value) {
      editingValueKey = null
      return
    }
    onChange([...path, editingValueKey], next)
    editingValueKey = null
  }

  function commitName() {
    if (editingNameKey === null || !onRenameKey) {
      editingNameKey = null
      return
    }
    const entry = entries.find(e => e.key === editingNameKey)
    if (!entry) {
      editingNameKey = null
      return
    }
    const next = editNameText.trim()
    if (!next || next === editingNameKey) {
      editingNameKey = null
      return
    }
    onRenameKey(path, editingNameKey, next)
    editingNameKey = null
  }

  function handleValueKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitValue()
    } else if (event.key === 'Escape') {
      editingValueKey = null
    }
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitName()
    } else if (event.key === 'Escape') {
      editingNameKey = null
    }
  }

  function entryPath(entry: StructureEntry): string[] {
    return [...path, entry.key]
  }
</script>

<span bind:this={measureEl} class="invisible absolute whitespace-pre text-sm font-mono leading-snug" aria-hidden="true"></span>

<div class="font-mono text-sm leading-snug">
  <div class="flex items-center gap-1 rounded px-1 py-px hover:bg-slate-800/40">
    <button
      type="button"
      class="relative inline-flex shrink-0 items-center justify-center rounded outline-none before:absolute before:-inset-1 before:content-[''] focus:text-cyan-300"
      aria-label={open ? t('structure.collapse', { name: label }) : t('structure.expand', { name: label })}
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <ChevronRightSmallIcon className="h-3 w-3 text-slate-400 transition-transform {open ? 'rotate-90' : ''}" />
    </button>
    <Copyable
      copyText={copyValue(value)}
      copyAriaLabel={label ? t('structure.copyValue', { name: label }) : t('structure.copyNode')}
      copyTooltip={label ? t('structure.copyValue', { name: label }) : t('structure.copyNode')}
    >
      {#if label !== ''}
        <span class="text-slate-300">{label}</span>
        <span class="text-slate-600">:</span>
      {/if}
      <span class="text-slate-400">{containerSummary(value)}</span>
    </Copyable>
  </div>

  {#if open}
    <div class="ml-[0.3rem] border-l border-slate-800 pl-2">
      {#each entries as entry (entry.key)}
        {#if isContainer(entry.value)}
          <Self
            label={entry.key}
            value={entry.value as object | unknown[]}
            depth={depth + 1}
            path={entryPath(entry)}
            {onChange}
            {onRenameKey}
          />
        {:else if editingValueKey === entry.key && onChange}
          <div class="flex items-center gap-1 rounded px-1 py-px">
            <span class="w-3 shrink-0"></span>
            <span class="text-slate-300 shrink-0">{entry.key}</span>
            <span class="text-slate-600 shrink-0">:</span>
            <div class="flex-1">
              <input
                bind:this={editValueInput}
                bind:value={editValueText}
                class="min-w-[2ch] rounded bg-slate-900 px-1 py-1 text-sm font-mono leading-snug outline outline-1 outline-cyan-500"
                style={`width: ${editValueMinWidth || 40}px`}
                onblur={commitValue}
                onkeydown={handleValueKeydown}
              />
            </div>
          </div>
        {:else if editingNameKey === entry.key && onRenameKey}
          <div class="flex items-center gap-1 rounded px-1 py-px">
            <span class="w-3 shrink-0"></span>
            <input
              bind:this={editNameInput}
              bind:value={editNameText}
              class="min-w-[2ch] rounded bg-slate-900 px-1 py-1 text-sm font-mono leading-snug text-slate-300 outline outline-1 outline-cyan-500"
              style={`width: ${editNameMinWidth || 40}px`}
              onblur={commitName}
              onkeydown={handleNameKeydown}
            />
            <span class="text-slate-600 shrink-0">:</span>
            <span class={valueClass(entry.value)}>{valueText(entry.value)}</span>
          </div>
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="group flex items-center gap-1 rounded px-1 py-px hover:bg-slate-800/40"
            ondblclick={onChange ? () => startEditValue(entry) : undefined}
          >
            <span class="w-3 shrink-0"></span>
            {#if onRenameKey}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="text-slate-300 shrink-0 cursor-pointer rounded outline-none hover:underline focus:underline"
                ondblclick={(e) => { e.stopPropagation(); startEditName(entry) }}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startEditName(entry) } }}
                title={t('structure.renameHint')}
                role="button"
                tabindex="0"
              >{entry.key}</span>
            {:else}
              <span class="text-slate-300 shrink-0">{entry.key}</span>
            {/if}
            <span class="text-slate-600 shrink-0">:</span>
            <span class="min-w-0 truncate text-slate-400">
              <span class={valueClass(entry.value)}>{valueText(entry.value)}</span>
            </span>
            {#if onChange}
              <span bind:this={editBtnEl} class="shrink-0 [@media(hover:hover)]:opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  size="sm"
                  variant="ghost"
                  ariaLabel={t('structure.editKey', { name: entry.key })}
                  tooltip={t('structure.editKey', { name: entry.key })}
                  onClick={(e) => { e.stopPropagation(); startEditValue(entry) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
                  className="bg-transparent p-1 h-auto w-auto text-slate-400 hover:text-cyan-300"
                >
                  {#snippet icon()}
                    <EditIcon />
                  {/snippet}
                </Button>
              </span>
            {/if}
            <span class="shrink-0 [@media(hover:hover)]:opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <Button
                size="sm"
                variant="ghost"
                ariaLabel={t('structure.copyValue', { name: entry.key })}
                tooltip={t('structure.copyValue', { name: entry.key })}
                onClick={(e) => { e.stopPropagation(); void handleCopy(copyValue(entry.value)) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
                className="bg-transparent p-1 h-auto w-auto text-slate-400 hover:text-cyan-300"
              >
                {#snippet icon()}
                  <CopyIcon />
                {/snippet}
              </Button>
            </span>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
