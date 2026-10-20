<script lang="ts">
  import StructureNode, { STRUCTURE_TEXT_CLASS, structureStyle } from './StructureNode.svelte'
  import { containerSummary, isContainer, valueClass, valueText } from './structure-value'
  import { getI18nContext } from '$lib/i18n.svelte'
  import type { SizeInput } from '$lib/size-scale'
  const i18n = getI18nContext()

  interface Props {
    value: unknown
    onChange?: (path: string[], newValue: unknown) => void
    onRenameKey?: (parentPath: string[], oldKey: string, newKey: string) => void
    editable?: boolean
    /** Replaces the tunable container header row classes (gaps, padding, highlight). */
    containerRowClass?: string
    /** Replaces the tunable leaf row classes (gaps, padding, highlight). */
    leafRowClass?: string
    /** Control scale; the tree's text and inner controls follow it. */
    size?: SizeInput
  }

  let { value, onChange, onRenameKey, editable = true, containerRowClass, leafRowClass, size = 'md' }: Props =
    $props()

  const treeStyle = $derived(structureStyle(size))

  function containerLabel(value: unknown): string {
    return Array.isArray(value)
      ? `array[${value.length}]`
      : `object{${Object.keys(value as Record<string, unknown>).length}}`
  }
</script>

<div class={`text-slate-300 ${STRUCTURE_TEXT_CLASS}`} style={treeStyle}>
  {#if value === undefined}
    <div class="text-[length:var(--tree-font)] italic text-slate-400">{i18n.t('structure.noContent')}</div>
  {:else if !isContainer(value)}
    <pre class={valueClass(value)}>{valueText(value)}</pre>
  {:else}
    <StructureNode
      label={containerSummary(value)}
      {value}
      depth={0}
      {onChange}
      {onRenameKey}
      {editable}
      {containerRowClass}
      {leafRowClass}
      {size} />
  {/if}
</div>
