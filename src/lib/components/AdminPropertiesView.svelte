<script lang="ts">
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import NumberInput from './NumberInput.svelte'
  import AdminSettingsBatchDialog from './AdminSettingsBatchDialog.svelte'
  import ResetIcon from '$lib/icons/ResetIcon.svelte'
  import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useAdminSettings>
  }

  let { settingsState }: Props = $props()

  const sourceLabels: Record<string, string> = {
    database: 'Saved',
    environment: 'Environment',
    default: 'Default',
  }
</script>

<div class="flex flex-col gap-4">
  <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
    {#each settingsState.settings as setting, i}
      <div
        class="grid items-center gap-2 p-3 {setting.kind === 'string'
          ? 'md:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.25fr)]'
          : 'md:grid-cols-[minmax(0,1fr)_11rem]'} {i > 0 ? 'border-t border-slate-800' : ''}">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-100">{setting.label}</span>
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
          <p class="mt-0.5 text-xs text-slate-500">{setting.description}</p>
          <p class="mt-0.5 text-xs text-slate-600">{setting.key} (env {setting.envKey})</p>
        </div>
        <div class="flex items-center gap-2">
          {#if setting.kind === 'string'}
          <input
            type="text"
            bind:value={settingsState.draftValues[setting.key]}
            disabled={settingsState.pending}
            aria-label={setting.label}
            spellcheck="false"
            class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500 disabled:opacity-40" />
          {:else}
          <NumberInput
            bind:value={settingsState.draftValues[setting.key]}
            min={setting.min}
            max={setting.max}
            disabled={settingsState.pending}
            ariaLabel={setting.label} />
          {/if}
          {#if setting.source === 'database'}
          <Button
            size="sm"
            ariaLabel={`Revert ${setting.label} to environment/default`}
            tooltip="Revert to environment/default"
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

  <Buttons>
    {#snippet children()}
      <Button
        variant="primary"
        accent="cyan"
        disabled={!settingsState.hasUnsavedChanges || settingsState.pending}
        pending={settingsState.pending}
        onClick={() => void settingsState.apply()}>
        Apply
      </Button>
      <Button disabled={settingsState.pending} onClick={() => void settingsState.reload()}>Reload</Button>
      <Button disabled={settingsState.pending || !settingsState.hasUnsavedChanges} onClick={() => settingsState.resetDraft()}>Reset</Button>
    {/snippet}
  </Buttons>
</div>

{#if settingsState.batchOpen}
  <AdminSettingsBatchDialog settingsState={settingsState} />
{/if}
