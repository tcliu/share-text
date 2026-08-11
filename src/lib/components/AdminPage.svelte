<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import { goto } from '$app/navigation'
  import Button from './Button.svelte'
  import Spinner from './Spinner.svelte'
  import LoginPanel from './LoginPanel.svelte'
  import AdminPanel from './AdminPanel.svelte'
  import { AdminAuthError, fetchAdminSession, logout } from '$lib/admin'

  type AuthState = 'checking' | 'unconfigured' | 'unauthenticated' | 'authenticated'
  let authState = $state<AuthState>('checking')
  let sessionError = $state<string | null>(null)

  async function handleLogout() {
    try {
      await logout()
    } catch {
      toast.error('Failed to sign out')
    }
    authState = 'unauthenticated'
  }

  async function checkSession() {
    try {
      const session = await fetchAdminSession()
      sessionError = null
      if (!session.configured) {
        authState = 'unconfigured'
      } else {
        authState = session.authenticated ? 'authenticated' : 'unauthenticated'
      }
    } catch (error) {
      if (error instanceof AdminAuthError) {
        sessionError = null
      } else {
        sessionError = error instanceof Error ? error.message : 'Failed to check admin session'
        toast.error(sessionError)
      }
      authState = 'unauthenticated'
    }
  }

  onMount(() => {
    void checkSession()
  })
</script>

<div class="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
  <header class="flex flex-none items-center justify-between border-b border-slate-800 px-4 py-2">
    <h1 class="text-md font-semibold text-slate-200">Admin</h1>
    <div class="flex items-center gap-2">
      <Button size="sm" ariaLabel="Go to Documents" tooltip="Go to Documents" onClick={() => goto('/')}>
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          </svg>
        {/snippet}
      </Button>
      {#if authState === 'authenticated'}
        <Button size="sm" ariaLabel="Sign out" tooltip="Sign out" onClick={() => void handleLogout()}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M3 4a1 1 0 0 1 1-1h7a1 1 0 1 1 0 2H5v10h6a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V4Zm11.7 4.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-2 2a1 1 0 1 1-1.4-1.4l.3-.3H11a1 1 0 1 1 0-2h4.1l-.4-.3a1 1 0 0 1 0-1.4Z" />
            </svg>
          {/snippet}
        </Button>
      {/if}
    </div>
  </header>
  <main class="min-h-0 flex-1">
    {#if authState === 'checking'}
      <div class="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    {:else if authState === 'authenticated'}
      <AdminPanel onSignedOut={() => (authState = 'unauthenticated')} />
    {:else}
      <LoginPanel
        configured={authState !== 'unconfigured'}
        message={sessionError}
        onAuthenticated={() => (authState = 'authenticated')}
        onClose={() => goto('/')} />
    {/if}
  </main>
</div>
