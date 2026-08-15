<script lang="ts">
  import { getShareTextContext } from '$lib/share-text-context'

  const context = getShareTextContext()

  let focusTarget = $state<HTMLButtonElement | null>(null)

  context.registerEditorFocus(() => focusTarget?.focus())
</script>

<button bind:this={focusTarget} type="button">
  Editor focus target
</button>
