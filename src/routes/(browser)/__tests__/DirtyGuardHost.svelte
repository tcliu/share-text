<script lang="ts">
  import { getShareTextContext } from '#lib/share-text-context.js'

  const context = getShareTextContext()

  let { confirmDiscard = () => {} }: { confirmDiscard?: () => void } = $props()

  $effect(() => {
    context.registerEditorGuard({
      isDirty: () => true,
      confirmDiscard,
      getCurrentDocumentId: () => 'aaaaaa',
    })

    return () => context.unregisterEditorGuard()
  })
</script>

<div>Dirty guard host</div>
