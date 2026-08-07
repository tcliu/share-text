<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { TypeActionsProps } from '$lib/document-types'
  import Button from './Button.svelte'
  import FormatDialog from './FormatDialog.svelte'

  let { type, content, onContentChange }: TypeActionsProps = $props()

  let formatDialogOpen = $state(false)

  async function handleFormatConfirm(indent: number) {
    const format = type.format
    if (!format) return
    const result = await format.format(content, indent)
    if (result.ok) {
      onContentChange(result.value ?? '')
    } else {
      toast.error('Cannot format: ' + (result.error ?? `Invalid ${type.label}`))
    }
    formatDialogOpen = false
  }
</script>

{#if type.format}
  <Button
    size="sm"
    ariaLabel={type.format.title}
    tooltip={type.format.title}
    onClick={() => (formatDialogOpen = true)}>
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
  show={formatDialogOpen}
  title={type.format?.title ?? ''}
  hasIndent={type.format?.hasIndent ?? true}
  onConfirm={indent => void handleFormatConfirm(indent)}
  onCancel={() => (formatDialogOpen = false)} />
