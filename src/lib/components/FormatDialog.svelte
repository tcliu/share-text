<script lang="ts">
  import { tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import FormField from './FormField.svelte'
  import NumberInput from './NumberInput.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

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
    buttonLabel,
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
    <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
      {#if hasIndent}
        <FormField label={i18n.t('format.indentation')} htmlFor="format-indent-input">
          <NumberInput
            id="format-indent-input"
            bind:this={numberInputRef}
            bind:value={indent}
            min={0}
            max={8}
            ariaLabel={i18n.t('format.indentation')}
            className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-500" />
        </FormField>
      {/if}
      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleConfirm}>{buttonLabel ?? i18n.t('format.apply')}</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>{i18n.t('common.reset')}</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}
