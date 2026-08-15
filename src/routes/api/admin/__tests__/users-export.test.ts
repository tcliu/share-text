// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usersMocks = vi.hoisted(() => ({
  exportUsersForAdmin: vi.fn(),
}))

vi.mock('$lib/server/users', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/users')>('$lib/server/users')
  return {
    ...actual,
    exportUsersForAdmin: usersMocks.exportUsersForAdmin,
  }
})

import { GET } from '../users/export/+server'

const exported = [
  {
    username: 'alice',
    email: 'alice@example.com',
    status: 'active',
  },
]

function getEvent(input: { url?: string; ip?: string } = {}) {
  return {
    url: new URL(input.url ?? 'http://localhost/api/admin/users/export'),
    getClientAddress: () => input.ip ?? '127.0.0.1',
  } as never
}

describe('GET /api/admin/users/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMocks.exportUsersForAdmin.mockResolvedValue(exported)
  })

  it('exports every user when no ids are given', async () => {
    const response = await GET(getEvent())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(exported)
    expect(usersMocks.exportUsersForAdmin).toHaveBeenCalledWith(undefined)
  })

  it('exports only the selected users when ids are given', async () => {
    const response = await GET(getEvent({ url: 'http://localhost/api/admin/users/export?ids=1,2' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(exported)
    expect(usersMocks.exportUsersForAdmin).toHaveBeenCalledWith([1, 2])
  })

  it('ignores an empty ids parameter', async () => {
    await GET(getEvent({ url: 'http://localhost/api/admin/users/export?ids=' }))

    expect(usersMocks.exportUsersForAdmin).toHaveBeenCalledWith(undefined)
  })

  it('rejects a non-numeric user id in the selection', async () => {
    const response = await GET(getEvent({ url: 'http://localhost/api/admin/users/export?ids=1,abc' }))

    expect(response.status).toBe(400)
    expect(usersMocks.exportUsersForAdmin).not.toHaveBeenCalled()
  })
})
