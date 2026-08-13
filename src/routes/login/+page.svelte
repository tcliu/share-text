<script lang="ts">
  import { goto } from '$app/navigation'
  import LoginPanel from '$lib/components/LoginPanel.svelte'

  let { data } = $props()

  function handleAuthenticated() {
    void goto('/admin/properties')
  }
</script>

<svelte:head>
  <title>Login</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <main class="min-h-0 flex-1">
    <LoginPanel
      configured={data.configured}
      onAuthenticated={handleAuthenticated}
      onClose={() => goto('/')} />
  </main>
</div>
