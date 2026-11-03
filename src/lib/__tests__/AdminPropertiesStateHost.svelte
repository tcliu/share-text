<script lang="ts">
  import { onMount } from 'svelte'
  import { useAdminProperties } from '#lib/use-admin-properties.svelte.js'
  import { createAppI18n, setI18nContext } from '#lib/i18n.svelte.js'

  type AdminSettingsState = ReturnType<typeof useAdminProperties>

  interface Props {
    onReady: (state: AdminSettingsState) => void
    loadOnMount?: boolean
  }

  let { onReady, loadOnMount = true }: Props = $props()

  setI18nContext(createAppI18n())
  const settingsState = useAdminProperties(() => {})

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
