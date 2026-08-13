interface RateLimitEntry {
  count: number
  resetAt: number
}

const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

const loginAttempts = new Map<string, RateLimitEntry>()
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function pruneExpiredAttempts() {
  const now = Date.now()
  for (const [ip, entry] of loginAttempts) {
    if (now >= entry.resetAt) {
      loginAttempts.delete(ip)
    }
  }
}

const cleanupTimer = setInterval(pruneExpiredAttempts, RATE_LIMIT_CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()

export function isLoginRateLimited(ip: string) {
  const entry = loginAttempts.get(ip)
  if (!entry) {
    return false
  }
  if (Date.now() >= entry.resetAt) {
    loginAttempts.delete(ip)
    return false
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS
}

export function recordLoginAttempt(ip: string) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return
  }
  entry.count += 1
}

export function resetLoginAttempts(ip: string) {
  loginAttempts.delete(ip)
}
