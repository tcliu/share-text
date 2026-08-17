<script lang="ts">
  import { goto } from '$app/navigation'
  import LoginPanel from '$lib/components/LoginPanel.svelte'
  import { t } from '$lib/i18n.svelte'

  let { data } = $props()

  function handleAuthenticated() {
    void goto('/admin/properties')
  }
</script>

<svelte:head>
  <title>{t('admin.loginTitle')}</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <main class="min-h-0 flex-1">
    <LoginPanel
      configured={data.configured}
      onAuthenticated={handleAuthenticated}
      onClose={() => goto('/')} />
  </main>
</div>
