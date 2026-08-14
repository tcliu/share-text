import { toast } from 'svelte-sonner'
import { fetchUserSession, login, logout, register } from '$lib/user-auth'
import type { User } from '$lib/documents'

export type UserAuthState = 'checking' | 'signedOut' | 'signedIn'

export function useUserAuth() {
  let state = $state<UserAuthState>('checking')
  let user = $state<User | null>(null)

  async function checkSession() {
    try {
      const session = await fetchUserSession()
      user = session.user
      state = session.user ? 'signedIn' : 'signedOut'
    } catch {
      state = 'signedOut'
      user = null
    }
  }

  async function signIn(identifier: string, password: string, rememberMe = false) {
    const result = await login(identifier, password, rememberMe)
    if (result.kind === 'user') {
      user = result.user
      state = 'signedIn'
    } else {
      user = null
      state = 'signedOut'
    }
    return result
  }

  async function signUp(username: string, email: string, password: string) {
    user = await register(username, email, password)
    state = 'signedIn'
  }

  async function signOut() {
    try {
      await logout()
    } catch {
      toast.error('Failed to sign out')
    }
    user = null
    state = 'signedOut'
  }

  return {
    get state() {
      return state
    },
    get user() {
      return user
    },
    checkSession,
    signIn,
    signUp,
    signOut,
  }
}
