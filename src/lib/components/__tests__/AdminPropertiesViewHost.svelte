<script lang="ts">
  import { onMount } from 'svelte'
  import AdminPropertiesView from '../AdminPropertiesView.svelte'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { createAppI18n, setI18nContext } from '$lib/i18n.svelte'

  interface Props {
    onReady: (state: ReturnType<typeof useAdminSettings>) => void
  }

  let { onReady }: Props = $props()

  setI18nContext(createAppI18n())
  const settingsState = useAdminSettings(() => {})

  let once = false
  $effect(() => {
    if (once) return
    once = true
    onReady(settingsState)
  })

  onMount(() => {
    void settingsState.load()
  })
</script>

<AdminPropertiesView {settingsState} />
