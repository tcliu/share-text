<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login, register } from '$lib/user-auth'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  type Mode = 'signin' | 'register'

  interface Props {
    onAuthenticated: (admin: boolean) => void
  }

  let { onAuthenticated }: Props = $props()

  let mode = $state<Mode>('signin')
  let identifier = $state('')
  let username = $state('')
  let email = $state('')
  let password = $state('')
  let rememberMe = $state(false)
  let pending = $state(false)
  let identifierInput = $state<HTMLInputElement | null>(null)
  let registerUsernameInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (mode === 'signin') {
      identifierInput?.focus()
    } else {
      registerUsernameInput?.focus()
    }
  })

  function switchMode(next: Mode) {
    mode = next
    password = ''
  }

  async function handleSignIn() {
    if (!identifier.trim() || !password) {
      toast.error(i18n.t('auth.toast.fillBoth'))
      return
    }
    pending = true
    try {
      const result = await login(identifier.trim(), password, rememberMe)
      onAuthenticated(result.kind === 'admin')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.t('auth.toast.signInFailed'))
    } finally {
      pending = false
    }
  }

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      toast.error(i18n.t('auth.toast.fillAll'))
      return
    }
    pending = true
    try {
      await register(username.trim(), email.trim(), password)
      onAuthenticated(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.t('auth.toast.createAccountFailed'))
    } finally {
      pending = false
    }
  }
</script>

<div class="flex min-h-full items-center justify-center px-4 py-10">
  <div class="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60">
    <h1 class="text-2xl font-semibold tracking-tight text-slate-100">{mode === 'signin' ? i18n.t('auth.login') : i18n.t('auth.createAccount')}</h1>
    <div class="mt-4">
      <div class="mb-4 flex rounded-lg border border-slate-700 p-0.5" role="group" aria-label={i18n.t('auth.accountOptions')}>
        <button
          type="button"
          aria-pressed={mode === 'signin'}
          onclick={() => switchMode('signin')}
          class={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition ${mode === 'signin' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200 focus:text-slate-200'}`}>
          {i18n.t('auth.login')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'register'}
          onclick={() => switchMode('register')}
          class={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition ${mode === 'register' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200 focus:text-slate-200'}`}>
          {i18n.t('auth.createAccount')}
        </button>
      </div>

      {#if mode === 'signin'}
        <form
          class="flex flex-col gap-4"
          use:useCaretAtEndOnKeyboardFocus
          onsubmit={e => {
            e.preventDefault()
            void handleSignIn()
          }}
          novalidate>
          <FormField label={i18n.t('auth.usernameOrEmail')} htmlFor="user-identifier">
            <input
              id="user-identifier"
              bind:this={identifierInput}
              bind:value={identifier}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label={i18n.t('auth.password')} htmlFor="user-password">
            <PasswordInput id="user-password" bind:value={password} disabled={pending} />
          </FormField>
          <Checkbox bind:checked={rememberMe} name="rememberMe" label={i18n.t('auth.rememberMe')} />
          <Button variant="primary" accent="cyan" type="submit" pending={pending} className="w-full">{i18n.t('auth.continue')}</Button>
        </form>
      {:else}
        <form
          class="flex flex-col gap-4"
          use:useCaretAtEndOnKeyboardFocus
          onsubmit={e => {
            e.preventDefault()
            void handleRegister()
          }}
          novalidate>
          <FormField label={i18n.t('auth.username')} htmlFor="register-username">
            <input
              id="register-username"
              bind:this={registerUsernameInput}
              bind:value={username}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label={i18n.t('auth.email')} htmlFor="register-email">
            <input
              id="register-email"
              bind:value={email}
              type="email"
              autocomplete="email"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label={i18n.t('auth.password')} htmlFor="register-password">
            <PasswordInput id="register-password" bind:value={password} disabled={pending} />
          </FormField>
          <Button variant="primary" accent="cyan" type="submit" pending={pending} className="w-full">{i18n.t('auth.continue')}</Button>
        </form>
      {/if}

      <div class="mt-4 text-center">
        <a href="/" class="text-sm text-slate-400 outline-none transition hover:text-cyan-400 focus:text-cyan-400">{i18n.t('auth.goToDocuments')}</a>
      </div>
    </div>
  </div>
</div>
