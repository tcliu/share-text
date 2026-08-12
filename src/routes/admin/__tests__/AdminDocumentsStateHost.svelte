<script lang="ts">
  import { onMount } from 'svelte'
  import { useAdminDocuments } from '$lib/use-admin-documents.svelte'

  type AdminDocumentsState = ReturnType<typeof useAdminDocuments>

  interface Props {
    onReady: (state: AdminDocumentsState) => void
    loadOnMount?: boolean
  }

  let { onReady, loadOnMount = true }: Props = $props()

  const documentsState = useAdminDocuments({ onSignedOut: () => {} })

  let once = false
  $effect(() => {
    if (once) return
    once = true
    onReady(documentsState)
  })

  onMount(() => {
    if (loadOnMount) void documentsState.load()
  })
</script>
