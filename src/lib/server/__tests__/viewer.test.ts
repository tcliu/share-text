// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import { USER_SESSION_COOKIE, createUserSessionToken } from '$lib/server/user-auth'
import { createUser, updateUser } from '$lib/server/users'
import { resolveViewer } from '$lib/server/viewer'

function eventWithCookie(token: string | null) {
  return {
    cookies: {
      get: (name: string) => (name === USER_SESSION_COOKIE ? token : undefined),
    },
    getClientAddress: () => '10.0.0.1',
  } as never
}

beforeEach(async () => {
  const db = await getDb()
  await db.query('delete from users')
})

describe('resolveViewer', () => {
  it('resolves an active user session to a user viewer', async () => {
    const user = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const token = createUserSessionToken(user.id)

    const viewer = await resolveViewer(eventWithCookie(token))

    expect(viewer).toMatchObject({ type: 'user', userId: user.id })
  })

  it('treats an inactive user session as anonymous', async () => {
    const user = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    await updateUser(user.id, { status: 'inactive' })
    const token = createUserSessionToken(user.id)

    const viewer = await resolveViewer(eventWithCookie(token))

    expect(viewer.type).toBe('anonymous')
  })

  it('treats a deleted user session as anonymous', async () => {
    const token = createUserSessionToken(9999)

    const viewer = await resolveViewer(eventWithCookie(token))

    expect(viewer.type).toBe('anonymous')
  })
})
