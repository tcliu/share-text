import { resolveProfile } from './profile'

export function sessionSecret() {
  const explicit = (process.env.SESSION_SECRET || '').trim()
  if (explicit) {
    return explicit
  }
  if (resolveProfile() === 'prod') {
    throw new Error('SESSION_SECRET must be set in production')
  }
  return 'dev-session-secret'
}
