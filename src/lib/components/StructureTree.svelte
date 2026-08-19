<script lang="ts">
  import StructureNode from './StructureNode.svelte'
  import { isContainer, valueClass, valueText } from './structure-value'

  interface Props {
    value: unknown
    onChange?: (path: string[], newValue: unknown) => void
    onRenameKey?: (parentPath: string[], oldKey: string, newKey: string) => void
    editable?: boolean
    testId?: string
  }

  let { value, onChange, onRenameKey, editable = true, testId = 'structure-tree' }: Props = $props()

  function containerLabel(value: unknown): string {
    return Array.isArray(value)
      ? `array[${value.length}]`
      : `object{${Object.keys(value as Record<string, unknown>).length}}`
  }
</script>

<div data-testid={testId} class="text-slate-300">
  {#if value === undefined}
    <div class="text-sm italic text-slate-400">No content to preview</div>
  {:else if !isContainer(value)}
    <pre class={valueClass(value)}>{valueText(value)}</pre>
  {:else}
    <StructureNode label={containerLabel(value)} value={value} depth={0} {onChange} {onRenameKey} {editable} />
  {/if}
</div>