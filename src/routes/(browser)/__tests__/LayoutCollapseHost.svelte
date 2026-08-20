<script lang="ts">
  import Layout from '../+layout.svelte'
  import LayoutFocusTarget from './LayoutFocusTarget.svelte'
  import DirtyGuardHost from './DirtyGuardHost.svelte'

  let {
    withDirtyGuard = false,
    confirmDiscard = () => {},
  }: { withDirtyGuard?: boolean; confirmDiscard?: () => void } = $props()
</script>

<Layout>
  <LayoutFocusTarget />
  {#if withDirtyGuard}
    <DirtyGuardHost {confirmDiscard} />
  {/if}
</Layout>
