import { getDb } from './db'

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

function newResetAtIso() {
  return new Date(Date.now() + LOGIN_WINDOW_MS).toISOString()
}

export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.query<{ attempt_count: number | string }>(
    'select attempt_count from login_attempts where ip = $1 and reset_at > $2',
    [ip, new Date().toISOString()],
  )
  return Number(result.rows[0]?.attempt_count ?? 0) >= LOGIN_MAX_ATTEMPTS
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  const db = await getDb()
  const nowIso = new Date().toISOString()
  await db.query('delete from login_attempts where ip = $1 and reset_at <= $2', [ip, nowIso])
  await db.query(
    `insert into login_attempts (ip, attempt_count, reset_at) values ($1, 1, $2)
     on conflict (ip) do update set attempt_count = login_attempts.attempt_count + 1`,
    [ip, newResetAtIso()],
  )
}

export async function resetLoginAttempts(ip: string): Promise<void> {
  const db = await getDb()
  await db.query('delete from login_attempts where ip = $1', [ip])
}
