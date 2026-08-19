<script lang="ts">
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import Spinner from './Spinner.svelte'
  import DeleteIcon from '$lib/icons/DeleteIcon.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'
  import { t } from '$lib/i18n.svelte'
  import { ttsLanguageLabel } from '$lib/tts-language'
  import type { useAdminTtsVoices } from '$lib/use-admin-tts-voices.svelte'

  interface Props {
    voicesState: ReturnType<typeof useAdminTtsVoices>
  }

  let { voicesState }: Props = $props()

  let modelFiles = $state<Record<string, File | null>>({})
  let configFiles = $state<Record<string, File | null>>({})
  let resetVersions = $state<Record<string, number>>({})

  function voiceOptions(lang: string) {
    return [
      { value: '', label: t('admin.tts.firstAvailable') },
      ...(voicesState.voices[lang] ?? []).map(voice => ({ value: voice, label: voice })),
    ]
  }

  function selectedVoiceLabel(lang: string) {
    return voiceOptions(lang).find(option => option.value === (voicesState.draftDefaults[lang] ?? ''))?.label ?? t('admin.tts.firstAvailable')
  }

  function uploadReady(lang: string) {
    return Boolean(modelFiles[lang] && configFiles[lang])
  }

  async function handleUpload(lang: string) {
    const model = modelFiles[lang]
    const config = configFiles[lang]
    if (!model || !config) return
    const uploaded = await voicesState.upload(lang, model, config)
    if (!uploaded) return
    modelFiles = { ...modelFiles, [lang]: null }
    configFiles = { ...configFiles, [lang]: null }
    resetVersions = { ...resetVersions, [lang]: (resetVersions[lang] ?? 0) + 1 }
  }
</script>

{#if voicesState.loading && !voicesState.loaded}
  <div class="flex h-full items-center justify-center">
    <Spinner className="h-6 w-6" />
  </div>
{:else}
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
      {#if !voicesState.configured}
        <div class="p-3">
          <p class="text-xs text-amber-300">{t('settings.readAloud.notConfigured')}</p>
        </div>
      {/if}
      {#each voicesState.languages as lang, i}
        <section class={i > 0 || !voicesState.configured ? 'border-t border-slate-800 p-3' : 'p-3'}>
          <div class="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
            <div>
              <div class="text-sm font-medium text-slate-100">{ttsLanguageLabel(lang)}</div>
              <div class="mt-0.5 text-xs tabular-nums text-slate-400">{lang}</div>
              <div class="mt-3">
                <div class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{t('admin.tts.defaultVoice')}</div>
                <SelectDropdown
                  buttonLabel={selectedVoiceLabel(lang)}
                  options={voiceOptions(lang)}
                  activeValue={voicesState.draftDefaults[lang] ?? ''}
                  ariaLabel={t('admin.tts.defaultVoiceFor', { language: ttsLanguageLabel(lang) })}
                  onSelect={value => voicesState.setDefaultVoice(lang, value || null)} />
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <div class="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{t('admin.tts.availableVoices')}</div>
                {#if (voicesState.voices[lang] ?? []).length === 0}
                  <p class="text-sm text-slate-400">{t('admin.tts.noVoices')}</p>
                {:else}
                  <div class="space-y-2">
                    {#each voicesState.voices[lang] ?? [] as voice}
                      <div class="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                        <div class="min-w-0">
                          <div class="truncate font-mono text-sm text-slate-200">{voice}</div>
                          {#if voicesState.draftDefaults[lang] === voice}
                            <div class="mt-0.5 text-xs text-cyan-300">{t('admin.tts.defaultSelected')}</div>
                          {/if}
                        </div>
                        <Button
                          size="sm"
                          ariaLabel={t('admin.tts.removeVoice', { voice })}
                          tooltip={t('admin.tts.removeVoice', { voice })}
                          pending={voicesState.actionPendingKey === `remove:${lang}:${voice}`}
                          onClick={() => void voicesState.remove(lang, voice)}
                          className="text-slate-400 hover:border-rose-500 hover:text-rose-300 focus:border-rose-500 focus:text-rose-300">
                          {#snippet icon()}
                            <DeleteIcon />
                          {/snippet}
                        </Button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              {#key `${lang}:${resetVersions[lang] ?? 0}`}
                <form class="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t('admin.tts.uploadVoice')}</div>
                <div class="grid gap-2 md:grid-cols-2">
                  <label class="block text-xs text-slate-300">
                    <span class="mb-1 block">{t('admin.tts.modelFile')}</span>
                    <input
                      type="file"
                      accept=".onnx"
                      class="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200 hover:border-slate-500 focus:border-cyan-500"
                      onchange={event => {
                        const input = event.currentTarget as HTMLInputElement
                        modelFiles = { ...modelFiles, [lang]: input.files?.[0] ?? null }
                      }} />
                  </label>
                  <label class="block text-xs text-slate-300">
                    <span class="mb-1 block">{t('admin.tts.configFile')}</span>
                    <input
                      type="file"
                      accept=".json"
                      class="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200 hover:border-slate-500 focus:border-cyan-500"
                      onchange={event => {
                        const input = event.currentTarget as HTMLInputElement
                        configFiles = { ...configFiles, [lang]: input.files?.[0] ?? null }
                      }} />
                  </label>
                </div>
                <div class="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    ariaLabel={t('admin.tts.uploadVoiceFor', { language: ttsLanguageLabel(lang) })}
                    tooltip={t('admin.tts.uploadVoiceFor', { language: ttsLanguageLabel(lang) })}
                    disabled={!uploadReady(lang)}
                    pending={voicesState.actionPendingKey === `upload:${lang}`}
                    onClick={() => void handleUpload(lang)}>
                    {#snippet icon()}
                      <UploadIcon />
                    {/snippet}
                  </Button>
                </div>
                </form>
              {/key}
            </div>
          </div>
        </section>
      {/each}
    </div>
    <Buttons>
      {#snippet children()}
        <Button
          variant="primary"
          accent="cyan"
          disabled={!voicesState.hasUnsavedChanges || voicesState.pending}
          pending={voicesState.pending}
          onClick={() => void voicesState.apply()}>
          {t('common.apply')}
        </Button>
        <Button disabled={voicesState.pending} onClick={() => void voicesState.reload()}>{t('common.reload')}</Button>
        <Button disabled={voicesState.pending || !voicesState.hasUnsavedChanges} onClick={() => voicesState.resetDraft()}>
          {t('common.reset')}
        </Button>
      {/snippet}
    </Buttons>
  </div>
{/if}
