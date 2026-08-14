import { beforeEach, describe, expect, it, vi } from 'vitest'

const usersMocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  findAdminUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    listUsers: usersMocks.listUsers,
    createUser: usersMocks.createUser,
    findAdminUserById: usersMocks.findAdminUserById,
    updateUser: usersMocks.updateUser,
    deleteUser: usersMocks.deleteUser,
  }
})

import { GET, POST } from '../+server'
import { DELETE, PUT } from '../[id]/+server'

const adminUser = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
} as const

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

function idEvent(input: { id: string; body?: unknown; method?: 'PUT' | 'DELETE' }) {
  const init: RequestInit = { method: input.method ?? 'PUT' }
  if (input.body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(input.body)
  }
  return {
    params: { id: input.id },
    request: new Request(`http://localhost/api/admin/users/${input.id}`, init),
    getClientAddress: () => '127.0.0.1',
  } as never
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.listUsers.mockResolvedValue({ users: [adminUser], total: 1, hasMore: false })
  })

  it('returns paginated users with total', async () => {
    const response = await GET({ url: new URL('http://localhost/api/admin/users?search=ali&limit=20&offset=0') } as never)

    expect(response.status).toBe(200)
    expect(usersMocks.listUsers).toHaveBeenCalledWith({
      search: 'ali',
      searchKeys: [],
      limit: 20,
      offset: 0,
      sortBy: undefined,
      order: undefined,
    })
    await expect(response.json()).resolves.toEqual({ users: [adminUser], total: 1, hasMore: false })
  })

  it('forwards searchKeys and sort parameters', async () => {
    const response = await GET({
      url: new URL('http://localhost/api/admin/users?search=ali&search-keys=username,email&sortBy=username&order=asc'),
    } as never)

    expect(response.status).toBe(200)
    expect(usersMocks.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ali', searchKeys: ['username', 'email'], sortBy: 'username', order: 'asc' }),
    )
  })

  it('rejects invalid pagination parameters', async () => {
    const response = await GET({ url: new URL('http://localhost/api/admin/users?limit=abc') } as never)
    expect(response.status).toBe(400)
  })
})

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.createUser.mockResolvedValue({ id: 1, username: 'alice', email: 'alice@example.com', status: 'active' })
    usersMocks.findAdminUserById.mockResolvedValue(adminUser)
  })

  it('creates an active user and returns the admin user', async () => {
    const response = await POST(postEvent({ body: { username: 'alice', email: 'alice@example.com', password: 's3cret' } }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ user: adminUser })
    expect(usersMocks.createUser).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 's3cret',
    })
    expect(usersMocks.updateUser).not.toHaveBeenCalled()
  })

  it('sets status to inactive when requested', async () => {
    usersMocks.createUser.mockResolvedValue({ id: 1, username: 'bob', email: 'bob@example.com', status: 'inactive' })
    usersMocks.updateUser.mockResolvedValue({ id: 1, username: 'bob', email: 'bob@example.com', status: 'inactive' })
    const response = await POST(
      postEvent({ body: { username: 'bob', email: 'bob@example.com', password: 's3cret', status: 'inactive' } }),
    )

    expect(response.status).toBe(201)
    expect(usersMocks.updateUser).toHaveBeenCalledWith(1, { status: 'inactive' })
  })

  it('rejects duplicate usernames or emails with 409', async () => {
    usersMocks.createUser.mockRejectedValue(new Error('username or email is already taken'))
    const response = await POST(postEvent({ body: { username: 'alice', email: 'alice@example.com', password: 'x' } }))

    expect(response.status).toBe(409)
  })

  it('rejects an invalid status', async () => {
    const response = await POST(postEvent({ body: { username: 'x', email: 'x@example.com', password: 'x', status: 'banned' } }))

    expect(response.status).toBe(400)
  })

  it('rejects an invalid body', async () => {
    const response = await POST(postEvent({ body: [] }))
    expect(response.status).toBe(400)
  })
})

describe('PUT /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.findAdminUserById.mockResolvedValue(adminUser)
    usersMocks.updateUser.mockResolvedValue(adminUser)
  })

  it('updates user fields and returns the admin user', async () => {
    const response = await PUT(
      idEvent({ id: '1', body: { username: 'alice2', email: 'alice2@example.com', status: 'inactive' } }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user: adminUser })
    expect(usersMocks.updateUser).toHaveBeenCalledWith(1, {
      username: 'alice2',
      email: 'alice2@example.com',
      status: 'inactive',
    })
  })

  it('updates a password when provided', async () => {
    await PUT(idEvent({ id: '1', body: { password: 'newpass' } }))

    expect(usersMocks.updateUser).toHaveBeenCalledWith(1, { password: 'newpass' })
  })

  it('rejects an empty change set', async () => {
    const response = await PUT(idEvent({ id: '1', body: {} }))
    expect(response.status).toBe(400)
  })

  it('rejects duplicate usernames or emails with 409', async () => {
    usersMocks.updateUser.mockRejectedValue(new Error('username or email is already taken'))
    const response = await PUT(idEvent({ id: '1', body: { username: 'taken' } }))

    expect(response.status).toBe(409)
  })

  it('returns 404 for a missing user', async () => {
    usersMocks.findAdminUserById.mockResolvedValue(null)
    const response = await PUT(idEvent({ id: '1', body: { username: 'x' } }))

    expect(response.status).toBe(404)
  })

  it('returns 404 for an invalid id', async () => {
    const response = await PUT(idEvent({ id: 'abc', body: { username: 'x' } }))
    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.findAdminUserById.mockResolvedValue(adminUser)
    usersMocks.deleteUser.mockResolvedValue(true)
  })

  it('deletes a user', async () => {
    const response = await DELETE(idEvent({ id: '1', method: 'DELETE' }))

    expect(response.status).toBe(204)
    expect(usersMocks.deleteUser).toHaveBeenCalledWith(1)
  })

  it('returns 404 for a missing user', async () => {
    usersMocks.findAdminUserById.mockResolvedValue(null)
    const response = await DELETE(idEvent({ id: '1', method: 'DELETE' }))

    expect(response.status).toBe(404)
  })
})
