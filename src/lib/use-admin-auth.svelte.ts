import { toast } from 'svelte-sonner'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { AdminAuthError, fetchAdminSession, logout } from '$lib/admin'

export type AdminAuthState = 'checking' | 'unauthenticated' | 'authenticated' | 'error'

export function useAdminAuth(params: { onSignedOut: () => void }) {
  const { onSignedOut } = params

  let state = $state<AdminAuthState>('checking')
  let sessionError = $state('')

  function redirectToLogin() {
    if (page.url.pathname !== '/login/admin') {
      void goto('/login/admin')
    }
  }

  function handleSignedOut() {
    onSignedOut()
    state = 'unauthenticated'
    redirectToLogin()
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      toast.error('Failed to sign out')
    }
    handleSignedOut()
  }

  async function checkSession() {
    try {
      const session = await fetchAdminSession()
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
      sessionError = error instanceof Error ? error.message : 'Failed to check admin session'
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
