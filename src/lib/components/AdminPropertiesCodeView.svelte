<script lang="ts">
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useAdminSettings>
  }

  let { settingsState }: Props = $props()
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  {#if settingsState.propertiesProblems.length > 0}
    <p class="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-300" role="alert">
      {settingsState.propertiesProblems.join(' ')}
    </p>
  {/if}
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
    <LazyCodeEditor
      bind:content={() => settingsState.propertiesText, value => settingsState.updatePropertiesText(value)}
      docType="properties"
      editable={!settingsState.pending}
      containerClass="h-full"
      editorClass="h-full rounded-lg border border-slate-700 bg-slate-950"
      editorAriaLabel={i18n.t('admin.settingsContent')} />
  </div>
</div>
