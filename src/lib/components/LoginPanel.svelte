<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login } from '$lib/admin'

  const REMEMBER_ME_STORAGE_KEY = 'share-text-admin-remembered-login'

  interface Props {
    configured: boolean
    message?: string | null
    onAuthenticated: () => void
    onClose: () => void
  }

  let { configured, message = null, onAuthenticated, onClose }: Props = $props()

  let usernameInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (configured) usernameInput?.focus()
  })

  let username = $state('')
  let password = $state('')
  let rememberMe = $state(false)
  let loginPending = $state(false)

  onMount(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_ME_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { username?: unknown }
        if (typeof parsed.username === 'string') {
          username = parsed.username
          rememberMe = true
        }
      }
    } catch {
      try {
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
      } catch {
        // ignore storage errors
      }
    }
  })

  async function handleLogin() {
    if (!username.trim() || !password) {
      toast.error('Please fill in both fields.')
      return
    }
    loginPending = true
    try {
      await login(username.trim(), password, rememberMe)
      if (rememberMe) {
        try {
          localStorage.setItem(REMEMBER_ME_STORAGE_KEY, JSON.stringify({ username: username.trim() }))
        } catch {
          // ignore storage errors
        }
      } else {
        try {
          localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
        } catch {
          // ignore storage errors
        }
      }
      onAuthenticated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in')
    } finally {
      loginPending = false
    }
  }
</script>

<div class="flex min-h-full items-center justify-center px-4 py-10">
  <div class="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60">
    <h2 class="text-2xl font-semibold tracking-tight text-slate-100">Admin</h2>
    <div class="mt-4">
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
              bind:this={usernameInput}
              bind:value={username}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label="Password" htmlFor="admin-password">
            <PasswordInput id="admin-password" bind:value={password} disabled={loginPending} />
          </FormField>
          <Checkbox bind:checked={rememberMe} name="rememberMe" label="Remember me" />
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
    </div>
  </div>
</div>
