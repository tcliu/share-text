<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Spinner from './Spinner.svelte'
  import LoginPanel from './LoginPanel.svelte'
  import AdminPanel from './AdminPanel.svelte'
  import { AdminAuthError, fetchAdminSession } from '$lib/admin'

  interface Props {
    onClose: () => void
    onAdminDelete: (id: string) => void
    onAdminChange: () => void
  }

  let { onClose, onAdminDelete, onAdminChange }: Props = $props()

  type AuthState = 'checking' | 'unconfigured' | 'unauthenticated' | 'authenticated'
  let authState = $state<AuthState>('checking')
  let sessionError = $state<string | null>(null)

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

{#if authState === 'checking'}
  <BaseDialog title="Admin" maxWidth="md" onCancel={onClose}>
      <div class="flex items-center justify-center pb-10">
      <Spinner className="h-6 w-6" />
    </div>
  </BaseDialog>
{:else if authState === 'authenticated'}
  <AdminPanel {onClose} {onAdminDelete} {onAdminChange} onSignedOut={() => (authState = 'unauthenticated')} />
{:else}
  <LoginPanel
    configured={authState !== 'unconfigured'}
    message={sessionError}
    onAuthenticated={() => (authState = 'authenticated')}
    {onClose} />
{/if}
