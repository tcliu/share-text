<script lang="ts">
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import FormField from './FormField.svelte'
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
      <p class="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100">{message}</p>
    {/if}
    <form
      class="flex flex-col gap-4"
      onsubmit={e => {
        e.preventDefault()
        void handleLogin()
      }}
      novalidate>
      <FormField label="Username" htmlFor="admin-username">
        <input
          id="admin-username"
          bind:value={username}
          type="text"
          autocomplete="username"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
      <FormField label="Password" htmlFor="admin-password">
        <PasswordInput id="admin-password" bind:value={password} disabled={loginPending} />
      </FormField>
      <Button variant="primary" accent="cyan" type="submit" pending={loginPending} className="w-full">Sign in</Button>
    </form>
  {:else}
    <p class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
      Admin authentication is not configured. Set <span class="font-semibold text-slate-100">ADMIN_PASSWORD</span>
      or{' '}
      <span class="font-semibold text-slate-100">ADMIN_PASSWORD_HASH</span> in the server environment to enable it.
    </p>
    <Buttons>
      {#snippet children()}
        <Button onClick={onClose}>Close</Button>
      {/snippet}
    </Buttons>
  {/if}
</BaseDialog>
