<script lang="ts">
  import { getShareTextContext } from '$lib/share-text-context'

  const context = getShareTextContext()
</script>

<button type="button" data-testid="open-drawer" onclick={() => context.openMobileDrawer()}>
  Open drawer
</button>
