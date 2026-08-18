<script lang="ts">
  import Tabs from './Tabs.svelte'
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import NumberInput from './NumberInput.svelte'
  import AdminPropertiesCodeView from './AdminPropertiesCodeView.svelte'
  import ResetIcon from '$lib/icons/ResetIcon.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { t, settingDescription, settingLabel } from '$lib/i18n.svelte'
  import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useAdminSettings>
  }

  let { settingsState }: Props = $props()

  const sourceLabels = $derived<Record<string, string>>({
    database: t('admin.source.saved'),
    environment: t('admin.source.environment'),
    default: t('admin.source.default'),
  })
</script>

{#snippet formContent()}
  <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50" use:useCaretAtEndOnKeyboardFocus>
    {#each settingsState.settings as setting, i}
      {@const label = settingLabel(setting.key) ?? setting.label}
      {@const description = settingDescription(setting.key) ?? setting.description}
      <div
        class="grid items-center gap-2 p-3 {setting.kind === 'string'
          ? 'md:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.25fr)]'
          : 'md:grid-cols-[minmax(0,1fr)_11rem]'} {i > 0 ? 'border-t border-slate-800' : ''}">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-100">{label}</span>
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide {setting.source ===
              'database'
                ? 'border-cyan-700 bg-cyan-950/50 text-cyan-200'
                : setting.source === 'environment'
                  ? 'border-violet-700 bg-violet-950/50 text-violet-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'}">
              {sourceLabels[setting.source]}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-slate-400">{description}</p>
          <p class="mt-0.5 text-xs text-slate-500">{setting.key} ({t('admin.env')} {setting.envKey})</p>
        </div>
        <div class="flex items-center gap-2">
          {#if setting.kind === 'string'}
          <input
            type="text"
            bind:value={settingsState.draftValues[setting.key]}
            disabled={settingsState.pending}
            aria-label={label}
            spellcheck="false"
            class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500 disabled:opacity-40" />
          {:else}
          <NumberInput
            bind:value={settingsState.draftValues[setting.key]}
            min={setting.min}
            max={setting.max}
            disabled={settingsState.pending}
            ariaLabel={label} />
          {/if}
          {#if setting.source === 'database'}
            <Button
              size="sm"
              ariaLabel={t('admin.revertLabelToDefault', { name: label })}
              tooltip={t('admin.revertToDefault')}
              tooltipAlign="right"
              disabled={settingsState.pending}
              onClick={() => void settingsState.resetSetting(setting)}
              className="shrink-0 text-slate-400 hover:text-cyan-300">
              {#snippet icon()}
                <ResetIcon />
              {/snippet}
            </Button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet codeContent()}
  <AdminPropertiesCodeView {settingsState} />
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <Tabs
    tabs={[
      { label: t('admin.properties.form'), path: 'form', content: formContent },
      { label: t('admin.tab.properties'), path: 'properties', content: codeContent },
    ]}
    state={{}}
    ariaLabel={t('admin.propertiesViews')} />

  <Buttons>
    {#snippet children()}
      <Button
        variant="primary"
        accent="cyan"
        disabled={!settingsState.hasUnsavedChanges || settingsState.pending}
        pending={settingsState.pending}
        onClick={() => void settingsState.apply()}>
        {t('common.apply')}
      </Button>
      <Button disabled={settingsState.pending} onClick={() => void settingsState.reload()}>{t('common.reload')}</Button>
      <Button
        disabled={settingsState.pending || !settingsState.hasUnsavedChanges}
        onClick={() => settingsState.resetDraft()}>
        {t('common.reset')}
      </Button>
    {/snippet}
  </Buttons>
</div>
