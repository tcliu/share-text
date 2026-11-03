<script lang="ts">
  import { tick } from 'svelte'
  import BaseDialog from '@codepg/ui-lib/components/BaseDialog.svelte'
  import Buttons from '@codepg/ui-lib/components/Buttons.svelte'
  import Button from '@codepg/ui-lib/components/Button.svelte'
  import FormField from '@codepg/ui-lib/components/FormField.svelte'
  import NumberInput from '@codepg/ui-lib/components/NumberInput.svelte'
  import { caretAtEndOnKeyboardFocus } from '@codepg/ui-lib/actions/caret-at-end-on-keyboard-focus'
  import { getI18nContext } from '#lib/i18n.svelte.js'
  const i18n = getI18nContext()

  interface Props {
    show: boolean
    title: string
    hasIndent?: boolean
    initialIndent?: number
    buttonLabel?: string
    className?: string
    widthVariant?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'fit'
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
    widthVariant = 'md',
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
  <BaseDialog {title} {className} {widthVariant} {onCancel}>
    <div class="flex flex-col gap-4" use:caretAtEndOnKeyboardFocus>
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
      <Buttons align="right">
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleConfirm}
            >{buttonLabel ?? i18n.t('format.apply')}</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>{i18n.t('common.reset')}</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}
