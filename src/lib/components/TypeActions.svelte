<script lang="ts">
  import type { TypeActionsProps } from '$lib/document-types'
  import Button from './Button.svelte'
  import FormatDialog from './FormatDialog.svelte'
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
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"
          clip-rule="evenodd" />
      </svg>
    {/snippet}
  </Button>
{/if}

<FormatDialog
  show={formatState.open}
  title={type.format?.title ?? ''}
  hasIndent={type.format?.hasIndent ?? true}
  onConfirm={indent => void formatState.confirm(indent)}
  onCancel={formatState.cancel} />
