import { toast } from 'svelte-sonner'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { AdminAuthError, fetchAdminSession, logout } from '$lib/admin'
import { getI18nContext } from '$lib/i18n.svelte'

export type AdminAuthState = 'checking' | 'unauthenticated' | 'authenticated' | 'error'

export function useAdminAuth(params: { onSignedOut: () => void }) {
  const i18n = getI18nContext()
  const { onSignedOut } = params

  let state = $state<AdminAuthState>('checking')
  let sessionError = $state('')

  function redirectToLogin() {
    if (page.url.pathname !== '/login') {
      void goto('/login')
    }
  }

  function handleSignedOut() {
    onSignedOut()
    state = 'unauthenticated'
    redirectToLogin()
  }

  async function handleLogout() {
    try {
      await logout(i18n)
    } catch {
      toast.error(i18n.t('auth.toast.signOutFailed'))
    }
    onSignedOut()
    state = 'unauthenticated'
    // Explicit sign-out lands on the browser page; expired sessions keep the
    // /login redirect (now landing + dialog) via handleSignedOut.
    if (page.url.pathname !== '/') {
      void goto('/')
    }
  }

  async function checkSession() {
    try {
      const session = await fetchAdminSession(i18n)
      if (session.authenticated) {
        state = 'authenticated'
        sessionError = ''
        return
      }
    } catch (error) {
      if (error instanceof AdminAuthError) {
        state = 'unauthenticated'
        redirectToLogin()
        return
      }
      // Transient failure (network, 5xx): don't bounce an authenticated user to
      // /login — show a retryable error instead. The server-side layout guard
      // already rejected genuinely unauthenticated sessions before render.
      sessionError = error instanceof Error ? error.message : i18n.t('admin.auth.toast.checkFailed')
      state = 'error'
      return
    }
    state = 'unauthenticated'
    redirectToLogin()
  }

  function retry() {
    state = 'checking'
    void checkSession()
  }

  return {
    get state() {
      return state
    },
    get sessionError() {
      return sessionError
    },
    checkSession,
    handleLogout,
    handleSignedOut,
    retry,
  }
}
