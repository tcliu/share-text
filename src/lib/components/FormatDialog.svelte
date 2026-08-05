<script lang="ts">
  import { tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import FormField from './FormField.svelte'
  import NumberInput from './NumberInput.svelte'

  interface Props {
    show: boolean
    title: string
    hasIndent?: boolean
    initialIndent?: number
    buttonLabel?: string
    className?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'fit'
    onConfirm: (indent: number) => void
    onCancel: () => void
  }

  let {
    show,
    title,
    hasIndent = true,
    initialIndent = 2,
    buttonLabel = 'Apply',
    className = '',
    maxWidth = 'md',
    onConfirm,
    onCancel,
  }: Props = $props()

  let indent = $state('2')
  let numberInputRef = $state<ReturnType<typeof NumberInput> | null>(null)

  $effect(() => {
    if (!show) return
    indent = String(initialIndent)
    tick().then(() => numberInputRef?.focus())
  })

  function handleConfirm() {
    const parsed = Number.parseInt(indent, 10)
    const resolved = Number.isNaN(parsed) ? initialIndent : parsed
    onConfirm(resolved)
  }

  const dirty = $derived(indent !== String(initialIndent))

  function handleReset() {
    indent = String(initialIndent)
    numberInputRef?.focus()
  }
</script>

{#if show}
  <BaseDialog {title} {className} {maxWidth} {onCancel}>
    <div class="flex flex-col gap-4">
      {#if hasIndent}
        <FormField label="Indentation (spaces)">
          <NumberInput
            bind:this={numberInputRef}
            bind:value={indent}
            min={0}
            max={8}
            ariaLabel="Indentation (spaces)"
            className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-500" />
        </FormField>
      {/if}
      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleConfirm}>{buttonLabel}</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>Reset</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}
