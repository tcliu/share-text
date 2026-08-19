<script lang="ts">
  import SelectDropdown from './SelectDropdown.svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    lang: string
    langLabel: string
    voices: string[]
    activeValue: string
    defaultVoice: string | null
    onSelect: (voice: string) => void
  }

  let { lang, langLabel, voices, activeValue, defaultVoice, onSelect }: Props = $props()

  const options = $derived([
    ...(defaultVoice ? [{ value: '', label: `${defaultVoice} (${t('settings.readAloud.voiceDefault')})` }] : []),
    ...voices.map(voice => ({
      value: voice,
      label: voice === defaultVoice ? `${voice} (${t('settings.readAloud.voiceDefault')})` : voice,
    })),
  ])

  const currentLabel = $derived(
    options.find(option => option.value === activeValue)?.label ?? (defaultVoice ? `${defaultVoice} (${t('settings.readAloud.voiceDefault')})` : ''),
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
    onSelect={onSelect} />
</div>
