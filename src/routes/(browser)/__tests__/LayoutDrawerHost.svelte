<script lang="ts">
  import Layout from '../+layout.svelte'
  import DrawerOpener from './DrawerOpener.svelte'
  import DirtyGuardHost from './DirtyGuardHost.svelte'

  let {
    withDirtyGuard = false,
    confirmDiscard = () => {},
  }: { withDirtyGuard?: boolean; confirmDiscard?: () => void } = $props()
</script>

<Layout>
  <DrawerOpener />
  {#if withDirtyGuard}
    <DirtyGuardHost {confirmDiscard} />
  {/if}
</Layout>
