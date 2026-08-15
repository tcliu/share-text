<script lang="ts">
  import Tabs from '../Tabs.svelte'

  interface Props {
    pathname?: string
  }

  let { pathname }: Props = $props()

  interface State {
    name: string
  }

  const state: State = { name: 'world' }
</script>

{#snippet alphaToolbar(state: State)}
  <span data-testid="toolbar-alpha">{state.name}</span>
{/snippet}

{#snippet alphaContent(state: State)}
  <span data-testid="content-alpha">{state.name}</span>
{/snippet}

{#snippet betaToolbar()}
  <span data-testid="toolbar-beta">beta-toolbar</span>
{/snippet}

{#snippet betaContent()}
  <span data-testid="content-beta">beta-content</span>
{/snippet}

<Tabs
  tabs={[
    { label: 'Alpha', path: '/a', toolbar: alphaToolbar, content: alphaContent },
    { label: 'Beta', path: '/b', toolbar: betaToolbar, content: betaContent },
  ]}
  {state}
  {pathname} />
