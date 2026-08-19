<script lang="ts">
  import SelectDropdown from './SelectDropdown.svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    lang: string
    langLabel: string
    voices: string[]
    activeValue: string
    onSelect: (voice: string) => void
  }

  let { lang, langLabel, voices, activeValue, onSelect }: Props = $props()

  const options = $derived([
    { value: '', label: t('settings.readAloud.voiceDefault') },
    ...voices.map(voice => ({ value: voice, label: voice })),
  ])

  const currentLabel = $derived(
    options.find(option => option.value === activeValue)?.label ?? t('settings.readAloud.voiceDefault'),
  )
</script>

<div class="grid items-center gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.35fr)]">
  <div>
    <span class="text-sm font-medium text-slate-100">{langLabel}</span>
    <p class="mt-0.5 text-xs tabular-nums text-slate-400">{lang}</p>
  </div>
  <SelectDropdown
    buttonLabel={currentLabel}
    options={options}
    activeValue={activeValue}
    ariaLabel={t('settings.readAloud.selectVoice', { language: langLabel })}
    size="md"
    panelClass="w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur"
    onSelect={onSelect} />
</div>