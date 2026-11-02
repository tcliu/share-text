<script lang="ts">
  import Button from '@codepg/ui-lib/components/Button.svelte'
  import NumberInput from '@codepg/ui-lib/components/NumberInput.svelte'
  import SelectDropdown from '@codepg/ui-lib/components/SelectDropdown.svelte'
  import ResetIcon from '@codepg/ui-lib/icons/ResetIcon.svelte'
  import { getI18nContext, type MessageKey } from '$lib/i18n.svelte'
  import type { AdminProperty } from '$lib/admin'

  interface Props {
    property: AdminProperty
    draft: string
    pending: boolean
    /** False for the first row, so the row above supplies the separator. */
    isFirst: boolean
    onDraft: (value: string) => void
    onReset: () => void
  }

  let { property, draft, pending, isFirst, onDraft, onReset }: Props = $props()
  const i18n = getI18nContext()

  const label = $derived(i18n.t(property.labelKey as MessageKey))
  const description = $derived(i18n.t(property.descriptionKey as MessageKey))

  const booleanOptions = $derived([
    { value: 'true', label: i18n.t('admin.yes') },
    { value: 'false', label: i18n.t('admin.no') },
  ])

  const sourceLabels = $derived<Record<string, string>>({
    database: i18n.t('admin.source.saved'),
    environment: i18n.t('admin.source.environment'),
    default: i18n.t('admin.source.default'),
  })

  function inputText(event: Event): string {
    return (event.target as HTMLInputElement).value
  }
</script>

<div
  class="grid items-center gap-2 p-3 {property.kind === 'string'
    ? 'md:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.25fr)]'
    : 'md:grid-cols-[minmax(0,1fr)_11rem]'} {isFirst ? '' : 'border-t border-slate-800'}">
  <div>
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-slate-100">{label}</span>
      <span
        class="rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase {property.source ===
        'database'
          ? 'border-cyan-700 bg-cyan-950/50 text-cyan-200'
          : property.source === 'environment'
            ? 'border-violet-700 bg-violet-950/50 text-violet-200'
            : 'border-slate-700 bg-slate-900 text-slate-400'}">
        {sourceLabels[property.source]}
      </span>
    </div>
    <p class="mt-0.5 text-xs text-slate-400">{description}</p>
    <p class="mt-0.5 text-xs text-slate-500">{property.key} ({i18n.t('admin.env')} {property.envKey})</p>
  </div>
  <div class="flex items-center gap-2">
    {#if property.kind === 'string'}
      <input
        type={property.masked ? 'password' : 'text'}
        value={draft}
        disabled={pending}
        aria-label={label}
        spellcheck="false"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition outline-none focus:border-cyan-500 disabled:opacity-40"
        oninput={event => onDraft(inputText(event))} />
    {:else if property.kind === 'boolean'}
      <SelectDropdown
        buttonLabel={draft === 'true' ? i18n.t('admin.yes') : i18n.t('admin.no')}
        options={booleanOptions}
        activeValue={draft}
        ariaLabel={label}
        onSelect={value => onDraft(value)} />
    {:else if property.kind === 'cron'}
      <input
        type="text"
        value={draft}
        disabled={pending}
        aria-label={label}
        spellcheck="false"
        placeholder="* * * * *"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 transition outline-none focus:border-cyan-500 disabled:opacity-40"
        oninput={event => onDraft(inputText(event))} />
    {:else}
      <NumberInput
        value={draft}
        min={property.min}
        max={property.max}
        step={1}
        disabled={pending}
        ariaLabel={label}
        oninput={event => onDraft(inputText(event))} />
    {/if}
    {#if property.source === 'database'}
      <Button
        ariaLabel={i18n.t('admin.revertLabelToDefault', { name: label })}
        tooltip={i18n.t('admin.revertToDefault')}
        tooltipAlign="right"
        disabled={pending}
        onClick={onReset}
        className="shrink-0 text-slate-400 hover:text-cyan-300">
        {#snippet icon()}
          <ResetIcon />
        {/snippet}
      </Button>
    {/if}
  </div>
</div>
