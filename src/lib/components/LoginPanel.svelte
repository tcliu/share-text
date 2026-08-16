<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import FormField from './FormField.svelte'
  import PasswordInput from './PasswordInput.svelte'
  import { login } from '$lib/admin'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { t } from '$lib/i18n.svelte'

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
      toast.error(t('auth.toast.fillBoth'))
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
      toast.error(error instanceof Error ? error.message : t('auth.toast.signInFailed'))
    } finally {
      loginPending = false
    }
  }
</script>

<div class="flex min-h-full items-center justify-center px-4 py-10">
  <div class="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60">
    <h1 class="text-2xl font-semibold tracking-tight text-slate-100">{t('auth.login')}</h1>
    <div class="mt-4">
      {#if configured}
        {#if message}
          <p class="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100">{message}</p>
        {/if}
        <form
          class="flex flex-col gap-4"
          use:useCaretAtEndOnKeyboardFocus
          onsubmit={e => {
            e.preventDefault()
            void handleLogin()
          }}
          novalidate>
          <FormField label={t('auth.username')} htmlFor="admin-username">
            <input
              id="admin-username"
              bind:this={usernameInput}
              bind:value={username}
              type="text"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
          </FormField>
          <FormField label={t('auth.password')} htmlFor="admin-password">
            <PasswordInput id="admin-password" bind:value={password} disabled={loginPending} />
          </FormField>
          <Checkbox bind:checked={rememberMe} name="rememberMe" label={t('auth.rememberMe')} />
          <Button variant="primary" accent="cyan" type="submit" pending={loginPending} className="w-full">{t('auth.signIn')}</Button>
          <a
            href="/"
            class="text-center text-sm text-slate-400 outline-none transition hover:text-cyan-400 focus:text-cyan-400"
            onclick={e => {
              e.preventDefault()
              void goto('/')
            }}>
            {t('auth.goToDocuments')}
          </a>
        </form>
      {:else}
        <p class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
          {t('admin.notConfiguredPrefix')}<span class="font-semibold text-slate-100">ADMIN_PASSWORD</span
          >{t('admin.notConfiguredSep')}<span class="font-semibold text-slate-100">ADMIN_PASSWORD_HASH</span
          >{t('admin.notConfiguredSuffix')}
        </p>
        <Buttons>
          {#snippet children()}
            <Button onClick={onClose}>{t('common.close')}</Button>
          {/snippet}
        </Buttons>
      {/if}
    </div>
  </div>
</div>
