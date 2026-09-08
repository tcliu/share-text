<script lang="ts">
  import { tick } from 'svelte'
  import { invalidateAll } from '$app/navigation'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login, register } from '$lib/user-auth'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  export type AuthPanelMode = 'signin' | 'register'

  interface Props {
    onAuthenticated?: (admin: boolean) => void
    embedded?: boolean
    onsuccess?: () => void
    mode?: AuthPanelMode
  }

  // `embedded` drops the standalone page's centering wrapper and card chrome
  // when the panel is hosted inside a dialog; `onsuccess` lets the host react
  // after the session refresh instead of navigating. `mode` is bindable so a
  // dialog host can title the dialog from the active mode.
  let { onAuthenticated, embedded = false, onsuccess, mode = $bindable('signin') }: Props = $props()

  let identifier = $state('')
  let username = $state('')
  let email = $state('')
  let password = $state('')
  let rememberMe = $state(false)
  let pending = $state(false)
  let error = $state('')
  let identifierInput = $state<HTMLInputElement | null>(null)
  let registerUsernameInput = $state<HTMLInputElement | null>(null)

  const outerClass = $derived(
    embedded ? 'w-full' : 'flex min-h-full items-center justify-center px-4 py-10 @max-md:p-0',
  )
  const cardClass = $derived(
    embedded
      ? 'w-full'
      : 'w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60 @max-md:max-w-none @max-md:self-stretch @max-md:rounded-none @max-md:border-x-0',
  )
  $effect(() => {
    if (mode === 'signin') {
      void tick().then(() => identifierInput?.focus())
    } else {
      void tick().then(() => registerUsernameInput?.focus())
    }
  })

  function switchMode(next: AuthPanelMode) {
    mode = next
    password = ''
    error = ''
  }

  async function handleSignIn() {
    if (!identifier.trim() || !password) {
      error = i18n.t('auth.toast.fillBoth')
      return
    }
    pending = true
    error = ''
    try {
      const result = await login(identifier.trim(), password, rememberMe)
      const admin = result.kind === 'admin'
      // The session cookie is fresh from the login response; re-run loads so
      // session-derived UI reflects the new session. Navigation stays with
      // the host via onAuthenticated; in-dialog hosts react via onsuccess.
      await invalidateAll()
      onAuthenticated?.(admin)
      onsuccess?.()
    } catch (err) {
      error = err instanceof Error ? err.message : i18n.t('auth.toast.signInFailed')
    } finally {
      pending = false
    }
  }

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      error = i18n.t('auth.toast.fillAll')
      return
    }
    pending = true
    error = ''
    try {
      await register(username.trim(), email.trim(), password)
      // Same as sign-in: force fresh loads so the header shows the profile.
      await invalidateAll()
      onAuthenticated?.(false)
      onsuccess?.()
    } catch (err) {
      error = err instanceof Error ? err.message : i18n.t('auth.toast.createAccountFailed')
    } finally {
      pending = false
    }
  }
</script>

<div class={outerClass}>
  <div class={cardClass}>
    {#if !embedded}
      <h1 class="text-2xl font-semibold tracking-tight text-slate-100">{mode === 'signin' ? i18n.t('auth.login') : i18n.t('auth.createAccount')}</h1>
    {/if}
    <div class={embedded ? '' : 'mt-4'}>
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
          {#if error}
            <p class="text-sm text-rose-400" role="alert">{error}</p>
          {/if}
          <Checkbox bind:checked={rememberMe} name="rememberMe" label={i18n.t('auth.rememberMe')} disabled={pending} />
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
          {#if error}
            <p class="text-sm text-rose-400" role="alert">{error}</p>
          {/if}
          <Button variant="primary" accent="cyan" type="submit" pending={pending} className="w-full">{i18n.t('auth.continue')}</Button>
        </form>
      {/if}

      {#if !embedded}
        <div class="mt-4 text-center">
          <a href="/" class="text-sm text-slate-400 outline-none transition hover:text-cyan-400 focus:text-cyan-400">{i18n.t('auth.goToDocuments')}</a>
        </div>
      {/if}
    </div>
  </div>
</div>
