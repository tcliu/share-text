<script lang="ts">
  import { onMount } from 'svelte'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'
  import { createShareTextI18n, setI18nContext } from '$lib/i18n.svelte'

  type AdminSettingsState = ReturnType<typeof useAdminSettings>

  interface Props {
    onReady: (state: AdminSettingsState) => void
    loadOnMount?: boolean
  }

  let { onReady, loadOnMount = true }: Props = $props()

  setI18nContext(createShareTextI18n())
  const settingsState = useAdminSettings(() => {})

  let once = false
  $effect(() => {
    if (once) return
    once = true
    onReady(settingsState)
  })

  onMount(() => {
    if (loadOnMount) void settingsState.load()
  })
</script>
