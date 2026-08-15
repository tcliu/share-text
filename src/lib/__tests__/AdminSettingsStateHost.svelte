<script lang="ts">
  import { onMount } from 'svelte'
  import { useAdminSettings } from '$lib/use-admin-settings.svelte'

  type AdminSettingsState = ReturnType<typeof useAdminSettings>

  interface Props {
    onReady: (state: AdminSettingsState) => void
    loadOnMount?: boolean
  }

  let { onReady, loadOnMount = true }: Props = $props()

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
