// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usersMocks = vi.hoisted(() => ({
  importUsersForAdmin: vi.fn(),
}))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    importUsersForAdmin: usersMocks.importUsersForAdmin,
  }
})

import { POST } from '../users/+server'

const imported = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
]

function postEvent(input: { ip?: string; body: unknown }) {
  return {
    request: new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.body),
    }),
    getClientAddress: () => input.ip ?? '127.0.0.1',
  } as never
}

describe('POST /api/admin/users (import)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.importUsersForAdmin.mockResolvedValue(imported)
  })

  it('imports a single user object', async () => {
    const response = await POST(
      postEvent({ body: { records: [{ username: 'alice', email: 'alice@example.com', password: 's3cret' }] } }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ users: imported, count: 1 })
    expect(usersMocks.importUsersForAdmin).toHaveBeenCalledWith([
      { username: 'alice', email: 'alice@example.com', password: 's3cret', status: undefined, passwordHash: undefined },
    ])
  })

  it('passes an optional passwordHash through to the import', async () => {
    const response = await POST(
      postEvent({
        body: {
          records: [{ username: 'alice', email: 'alice@example.com', passwordHash: 'scrypt$c2FsdA==$aGFzaA==' }],
        },
      }),
    )

    expect(response.status).toBe(201)
    expect(usersMocks.importUsersForAdmin).toHaveBeenCalledWith([
      {
        username: 'alice',
        email: 'alice@example.com',
        password: undefined,
        status: undefined,
        passwordHash: 'scrypt$c2FsdA==$aGFzaA==',
      },
    ])
  })

  it('imports an array of users with an optional status', async () => {
    const response = await POST(
      postEvent({
        body: {
          records: [
            { username: 'alice', email: 'alice@example.com', password: 's3cret' },
            { username: 'bob', email: 'bob@example.com', password: 's3cret', status: 'inactive' },
          ],
        },
      }),
    )

    expect(response.status).toBe(201)
    expect(usersMocks.importUsersForAdmin).toHaveBeenCalledWith([
      { username: 'alice', email: 'alice@example.com', password: 's3cret', status: undefined, passwordHash: undefined },
      { username: 'bob', email: 'bob@example.com', password: 's3cret', status: 'inactive', passwordHash: undefined },
    ])
  })

  it('rejects a body whose records field is not an array', async () => {
    const response = await POST(postEvent({ body: { records: 'nope' } }))

    expect(response.status).toBe(400)
    expect(usersMocks.importUsersForAdmin).not.toHaveBeenCalled()
  })

  it('rejects an empty records array', async () => {
    const response = await POST(postEvent({ body: { records: [] } }))

    expect(response.status).toBe(400)
  })

  it('rejects more than the maximum record count', async () => {
    const records = Array.from({ length: 501 }, (_, i) => ({
      username: `user-${i}`,
      email: `user-${i}@example.com`,
      password: 'x',
    }))
    const response = await POST(postEvent({ body: { records } }))

    expect(response.status).toBe(400)
    expect(usersMocks.importUsersForAdmin).not.toHaveBeenCalled()
  })

  it('rejects a non-object record', async () => {
    const response = await POST(postEvent({ body: { records: ['not an object'] } }))

    expect(response.status).toBe(400)
  })

  it('rejects a record with unsupported fields', async () => {
    const response = await POST(
      postEvent({ body: { records: [{ username: 'a', email: 'a@example.com', password: 'x', role: 'admin' }] } }),
    )

    expect(response.status).toBe(400)
    expect(usersMocks.importUsersForAdmin).not.toHaveBeenCalled()
  })

  it('returns a validation error from the import with a 400 status', async () => {
    usersMocks.importUsersForAdmin.mockRejectedValue(new Error('record 2: username or email is already taken'))
    const response = await POST(
      postEvent({
        body: {
          records: [
            { username: 'a', email: 'a@example.com', password: 'x' },
            { username: 'a', email: 'b@example.com', password: 'x' },
          ],
        },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'record 2: username or email is already taken' })
  })
})
