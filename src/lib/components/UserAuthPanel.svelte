<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login, register } from '$lib/user-auth'

  type Mode = 'signin' | 'register'

  interface Props {
    onAuthenticated: () => void
  }

  let { onAuthenticated }: Props = $props()

  let mode = $state<Mode>('signin')
  let identifier = $state('')
  let username = $state('')
  let email = $state('')
  let password = $state('')
  let rememberMe = $state(false)
  let pending = $state(false)

  function switchMode(next: Mode) {
    mode = next
    password = ''
  }

  async function handleSignIn() {
    if (!identifier.trim() || !password) {
      toast.error('Please fill in both fields.')
      return
    }
    pending = true
    try {
      await login(identifier.trim(), password, rememberMe)
      onAuthenticated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in')
    } finally {
      pending = false
    }
  }

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      toast.error('Please fill in all fields.')
      return
    }
    pending = true
    try {
      await register(username.trim(), email.trim(), password)
      onAuthenticated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      pending = false
    }
  }
</script>

<div class="flex min-h-full items-center justify-center px-4 py-10">
  <div class="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60">
    <h2 class="text-2xl font-semibold tracking-tight text-slate-100">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
    <div class="mt-4">
      <div class="mb-4 flex rounded-lg border border-slate-700 p-0.5" role="group" aria-label="Account options">
        <button
          type="button"
          aria-pressed={mode === 'signin'}
          onclick={() => switchMode('signin')}
          class={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'signin' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === 'register'}
          onclick={() => switchMode('register')}
          class={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'register' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
          Create account
        </button>
      </div>

      {#if mode === 'signin'}
        <form
          class="flex flex-col gap-4"
          onsubmit={e => {
            e.preventDefault()
            void handleSignIn()
          }}
          novalidate>
          <FormField label="Username or email" htmlFor="user-identifier">
            <input
              id="user-identifier"
              bind:value={identifier}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label="Password" htmlFor="user-password">
            <PasswordInput id="user-password" bind:value={password} disabled={pending} />
          </FormField>
          <Checkbox bind:checked={rememberMe} name="rememberMe" label="Remember me" />
          <Button variant="primary" accent="cyan" type="submit" pending={pending} className="w-full">Continue</Button>
        </form>
      {:else}
        <form
          class="flex flex-col gap-4"
          onsubmit={e => {
            e.preventDefault()
            void handleRegister()
          }}
          novalidate>
          <FormField label="Username" htmlFor="register-username">
            <input
              id="register-username"
              bind:value={username}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label="Email" htmlFor="register-email">
            <input
              id="register-email"
              bind:value={email}
              type="email"
              autocomplete="email"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label="Password" htmlFor="register-password">
            <PasswordInput id="register-password" bind:value={password} disabled={pending} />
          </FormField>
          <Button variant="primary" accent="cyan" type="submit" pending={pending} className="w-full">Continue</Button>
        </form>
      {/if}

      <div class="mt-4 text-center">
        <a href="/" class="text-sm text-slate-400 transition hover:text-cyan-400">Go to Documents</a>
      </div>
    </div>
  </div>
</div>
