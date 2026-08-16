import { toast } from 'svelte-sonner'
import { fetchUserSession, login, logout, register, type AdminIdentity } from '$lib/user-auth'
import type { User } from '$lib/documents'
import { t } from '$lib/i18n.svelte'

export type UserAuthState = 'checking' | 'signedOut' | 'signedIn'

export function useUserAuth() {
  let state = $state<UserAuthState>('checking')
  let user = $state<User | null>(null)
  let admin = $state<AdminIdentity | null>(null)

  async function checkSession() {
    try {
      const session = await fetchUserSession()
      user = session.user
      admin = session.admin
      state = session.user || session.admin ? 'signedIn' : 'signedOut'
    } catch {
      state = 'signedOut'
      user = null
      admin = null
    }
  }

  async function signIn(identifier: string, password: string, rememberMe = false) {
    const result = await login(identifier, password, rememberMe)
    if (result.kind === 'user') {
      user = result.user
      admin = null
      state = 'signedIn'
    } else {
      user = null
      admin = null
      state = 'signedOut'
    }
    return result
  }

  async function signUp(username: string, email: string, password: string) {
    user = await register(username, email, password)
    admin = null
    state = 'signedIn'
  }

  async function signOut() {
    try {
      await logout()
    } catch {
      toast.error(t('auth.toast.signOutFailed'))
    }
    user = null
    admin = null
    state = 'signedOut'
  }

  return {
    get state() {
      return state
    },
    get user() {
      return user
    },
    get admin() {
      return admin
    },
    checkSession,
    signIn,
    signUp,
    signOut,
  }
}
