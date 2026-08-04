<script lang="ts">
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import DialogActions from './DialogActions.svelte'
  import Button from './Button.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login } from '$lib/admin'

  interface Props {
    configured: boolean
    message?: string | null
    onAuthenticated: () => void
    onClose: () => void
  }

  let { configured, message = null, onAuthenticated, onClose }: Props = $props()

  let username = $state('')
  let password = $state('')
  let loginPending = $state(false)

  async function handleLogin() {
    if (!username.trim() || !password) {
      toast.error('Please fill in both fields.')
      return
    }
    loginPending = true
    try {
      await login(username.trim(), password)
      toast.success('Signed in')
      onAuthenticated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in')
    } finally {
      loginPending = false
    }
  }
</script>

<BaseDialog title="Admin" maxWidth="md" pending={loginPending} onCancel={onClose}>
  {#if configured}
    {#if message}
      <p class="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100">{message}</p>
    {/if}
    <form
      class="mt-5 space-y-3"
      onsubmit={e => {
        e.preventDefault()
        void handleLogin()
      }}
      novalidate>
      <div>
        <label for="admin-username" class="mb-1.5 block text-sm font-medium text-slate-200">Username</label>
        <input
          id="admin-username"
          bind:value={username}
          type="text"
          autocomplete="username"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </div>
      <div>
        <label for="admin-password" class="mb-1.5 block text-sm font-medium text-slate-200">Password</label>
        <PasswordInput id="admin-password" bind:value={password} disabled={loginPending} />
      </div>
      <Button variant="primary" accent="cyan" type="submit" pending={loginPending} className="mt-2 w-full">Sign in</Button>
    </form>
  {:else}
    <p class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
      Admin authentication is not configured. Set <span class="font-semibold text-slate-100">ADMIN_PASSWORD</span>
      or{' '}
      <span class="font-semibold text-slate-100">ADMIN_PASSWORD_HASH</span> in the server environment to enable it.
    </p>
    <DialogActions>
      {#snippet children()}
        <Button onClick={onClose}>Close</Button>
      {/snippet}
    </DialogActions>
  {/if}
</BaseDialog>
