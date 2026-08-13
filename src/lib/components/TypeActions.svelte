<script lang="ts">
  import type { TypeActionsProps } from '$lib/document-types'
  import Button from './Button.svelte'
  import FormatDialog from './FormatDialog.svelte'
  import FormatIcon from '$lib/icons/FormatIcon.svelte'
  import { useFormat } from './use-format.svelte'

  let { type, content, onContentChange }: TypeActionsProps = $props()

  const formatState = useFormat({
    format: () => type.format,
    content: () => content,
    setContent: value => onContentChange(value),
    label: () => type.label,
  })
</script>

{#if type.format}
  <Button
    size="sm"
    ariaLabel={type.format.title}
    tooltip={type.format.title}
    onClick={formatState.openDialog}>
    {#snippet icon()}
      <FormatIcon />
    {/snippet}
  </Button>
{/if}

<FormatDialog
  show={formatState.open}
  title={type.format?.title ?? ''}
  hasIndent={type.format?.hasIndent ?? true}
  onConfirm={indent => void formatState.confirm(indent)}
  onCancel={formatState.cancel} />
