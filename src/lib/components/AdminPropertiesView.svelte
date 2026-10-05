<script lang="ts">
  import Tabs from './Tabs.svelte'
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import SearchInput from './SearchInput.svelte'
  import Chip from './Chip.svelte'
  import AdminPropertyRow from './AdminPropertyRow.svelte'
  import AdminPropertiesCodeView from './AdminPropertiesCodeView.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { getI18nContext, type MessageKey } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import type { useAdminProperties } from '$lib/use-admin-properties.svelte'

  interface Props {
    settingsState: ReturnType<typeof useAdminProperties>
  }

  let { settingsState }: Props = $props()

  let query = $state('')
  let selectedTags = $state(new Set<string>())

  // Fixed taxonomy order; only tags present in the loaded properties render.
  const TAG_ORDER = ['app', 'documents']
  const availableTags = $derived(
    TAG_ORDER.filter(tag => settingsState.settings.some(setting => setting.tags?.includes(tag))),
  )

  function toggleTag(tag: string): void {
    const next = new Set(selectedTags)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    selectedTags = next
  }

  const normalizedQuery = $derived(query.trim().toLowerCase())
  const filteredSettings = $derived(
    settingsState.settings.filter(setting => {
      if (selectedTags.size > 0 && !(setting.tags ?? []).some(tag => selectedTags.has(tag))) {
        return false
      }
      if (!normalizedQuery) return true
      const searchable = [
        i18n.t(setting.labelKey as MessageKey),
        i18n.t(setting.descriptionKey as MessageKey),
        setting.key,
        setting.envKey,
        (setting.tags ?? []).join(' '),
      ]
        .join('\n')
        .toLowerCase()
      return searchable.includes(normalizedQuery)
    }),
  )
</script>

{#snippet formContent()}
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex flex-none flex-wrap items-center gap-2">
      <SearchInput
        bind:value={query}
        ariaLabel={i18n.t('admin.properties.searchAria')}
        placeholder={i18n.t('admin.properties.searchPlaceholder')}
        wrapperClass="w-full sm:max-w-sm" />
      {#if availableTags.length > 0}
        <div class="flex min-h-7 flex-none items-center gap-2" role="group" aria-label={i18n.t('admin.tagFilter')}>
          {#each availableTags as tag (tag)}
            <Chip
              label={tag}
              chipClass="border border-slate-600 bg-slate-900 text-slate-300"
              active={selectedTags.has(tag)}
              onclick={() => toggleTag(tag)} />
          {/each}
          {#if selectedTags.size > 0}
            <Button size="sm" ariaLabel={i18n.t('admin.clearTagFilters')} onClick={() => (selectedTags = new Set())}>
              {#snippet icon()}
                <CloseIcon />
              {/snippet}
            </Button>
          {/if}
        </div>
      {/if}
    </div>
    <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50" use:useCaretAtEndOnKeyboardFocus>
      {#each filteredSettings as setting, i (setting.key)}
        <AdminPropertyRow
          property={setting}
          draft={settingsState.draftValues[setting.key] ?? String(setting.value)}
          pending={settingsState.pending}
          isFirst={i === 0}
          onDraft={value => settingsState.setDraftValue(setting.key, value)}
          onReset={() => void settingsState.resetSetting(setting)} />
      {/each}
      {#if filteredSettings.length === 0}
        <p role="status" class="p-3 text-sm text-slate-400">{i18n.t('admin.properties.emptySearch')}</p>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet codeContent()}
  <AdminPropertiesCodeView {settingsState} />
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <Tabs
    tabs={[
      { label: i18n.t('admin.properties.form'), path: 'form', content: formContent },
      { label: i18n.t('admin.tab.properties'), path: 'properties', content: codeContent },
    ]}
    state={{}}
    ariaLabel={i18n.t('admin.propertiesViews')} />

  <Buttons align="right">
    {#snippet children()}
      <Button
        variant="primary"
        accent="cyan"
        disabled={!settingsState.hasUnsavedChanges || settingsState.pending}
        pending={settingsState.pending}
        onClick={() => void settingsState.apply()}>
        {i18n.t('common.apply')}
      </Button>
      <Button disabled={settingsState.pending} onClick={() => void settingsState.reload()}
        >{i18n.t('common.reload')}</Button>
      <Button
        disabled={settingsState.pending || !settingsState.hasUnsavedChanges}
        onClick={() => settingsState.resetDraft()}>
        {i18n.t('common.reset')}
      </Button>
    {/snippet}
  </Buttons>
</div>
