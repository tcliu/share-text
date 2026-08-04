<script lang="ts">
  import Button from './Button.svelte'
  import DialogActions from './DialogActions.svelte'
  import NumberInput from './NumberInput.svelte'
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
        class="grid items-center gap-2 p-3 md:grid-cols-[minmax(0,1fr)_11rem] {i > 0 ? 'border-t border-slate-800' : ''}">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-100">{setting.label}</span>
            <span
              class="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide {setting.source ===
              'database'
                ? 'border-cyan-700 bg-cyan-950/50 text-cyan-200'
                : setting.source === 'environment'
                  ? 'border-violet-700 bg-violet-950/50 text-violet-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'}">
              {sourceLabels[setting.source]}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-slate-500">{setting.description}</p>
          <p class="mt-0.5 text-[11px] text-slate-600">{setting.key} (env {setting.envKey})</p>
        </div>
        <div class="flex items-center gap-2">
          <NumberInput
            bind:value={settingsState.draftValues[setting.key]}
            min={setting.min}
            max={setting.max}
            disabled={settingsState.pending}
            ariaLabel={setting.label} />
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
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                  clip-rule="evenodd" />
              </svg>
            {/snippet}
          </Button>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <DialogActions>
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
  </DialogActions>
</div>
