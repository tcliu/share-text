<script lang="ts">
  import { goto } from '$app/navigation'
  import UserAuthPanel from '$lib/components/UserAuthPanel.svelte'
  import { t } from '$lib/i18n.svelte'

  function handleAuthenticated(admin = false) {
    void goto(admin ? '/admin/general' : '/')
  }
</script>

<svelte:head>
  <title>{t('auth.login')}</title>
</svelte:head>

<div class="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-200">
  <main class="min-h-0 flex-1">
    <UserAuthPanel onAuthenticated={handleAuthenticated} />
  </main>
</div>
