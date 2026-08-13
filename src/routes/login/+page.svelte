<script lang="ts">
  import { goto } from '$app/navigation'
  import UserAuthPanel from '$lib/components/UserAuthPanel.svelte'

  function handleAuthenticated() {
    void goto('/')
  }
</script>

<svelte:head>
  <title>Sign in</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <main class="min-h-0 flex-1">
    <UserAuthPanel onAuthenticated={handleAuthenticated} />
  </main>
</div>
