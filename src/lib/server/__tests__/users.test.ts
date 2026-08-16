// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import { hashPassword } from '$lib/server/password'
import { insertDocument, setDocumentAccess } from '$lib/server/documents'
import {
  createUser,
  deleteUser,
  exportUsersForAdmin,
  findAdminUserById,
  findUserByCredentials,
  findUserById,
  findUsersByUsernameOrEmail,
  importUsersForAdmin,
  listRecentSharees,
  listUsers,
  normalizeEmail,
  normalizeStatus,
  normalizeUsername,
  searchUsers,
  updateUser,
} from '$lib/server/users'

beforeEach(async () => {
  const db = await getDb()
  await db.query('delete from users')
})

describe('normalizeUsername', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Alice_42 ')).toBe('alice_42')
  })

  it('rejects empty and malformed usernames', () => {
    expect(() => normalizeUsername('')).toThrow('username is required')
    expect(() => normalizeUsername('ab')).toThrow('must be 3-32')
    expect(() => normalizeUsername('has spaces')).toThrow('must be 3-32')
    expect(normalizeUsername('UPPER')).toBe('upper')
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  it('rejects invalid emails', () => {
    expect(() => normalizeEmail('')).toThrow('email is required')
    expect(() => normalizeEmail('not-an-email')).toThrow('valid email')
  })
})

describe('users against the SQLite backend (dev profile)', () => {
  it('creates and looks up a user', async () => {
    const user = await createUser({ username: 'Alice', email: 'Alice@Example.com', password: 's3cret' })

    expect(user).toMatchObject({ username: 'alice', email: 'alice@example.com' })

    const byId = await findUserById(user.id)
    expect(byId).toMatchObject({ username: 'alice', email: 'alice@example.com' })

    expect(await findUserByCredentials('alice', 's3cret')).toMatchObject({ id: user.id })
    expect(await findUserByCredentials('ALICE@example.com', 's3cret')).toMatchObject({ id: user.id })
  })

  it('rejects a wrong password and unknown identifier', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 's3cret' })

    expect(await findUserByCredentials('alice', 'wrong')).toBeNull()
    expect(await findUserByCredentials('nobody', 's3cret')).toBeNull()
    expect(await findUserByCredentials('', '')).toBeNull()
  })

  it('rejects duplicate usernames and emails', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 's3cret' })

    await expect(createUser({ username: 'alice', email: 'other@example.com', password: 'x' })).rejects.toThrow(
      'already taken',
    )
    await expect(createUser({ username: 'bob', email: 'alice@example.com', password: 'x' })).rejects.toThrow(
      'already taken',
    )
  })

  it('rejects an empty password', async () => {
    await expect(createUser({ username: 'alice', email: 'a@example.com', password: '' })).rejects.toThrow(
      'password is required',
    )
  })

  it('searches users by username or email prefix', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })

    const byUsername = await searchUsers('ali')
    expect(byUsername.map(user => user.username)).toEqual(['alice'])

    const byEmail = await searchUsers('bob@')
    expect(byEmail.map(user => user.username)).toEqual(['bob'])

    expect(await searchUsers('')).toEqual([])
    expect(await searchUsers('zzz')).toEqual([])
  })

  it('creates users as active and rejects login for inactive users', async () => {
    const user = await createUser({ username: 'alice', email: 'alice@example.com', password: 's3cret' })
    expect(user.status).toBe('active')
    expect(await findUserByCredentials('alice', 's3cret')).toMatchObject({ id: user.id })

    await updateUser(user.id, { status: 'inactive' })
    expect(await findUserByCredentials('alice', 's3cret')).toBeNull()
    expect((await findUserById(user.id))?.status).toBe('inactive')
  })

  it('excludes inactive users from search and share resolution', async () => {
    const alice = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })
    await updateUser(alice.id, { status: 'inactive' })

    expect((await searchUsers('ali')).map(user => user.username)).toEqual([])
    const resolved = await findUsersByUsernameOrEmail(['alice', 'bob'])
    expect(resolved.map(user => user.username)).toEqual(['bob'])
  })

  it('includes inactive users in search when requested', async () => {
    const alice = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    await updateUser(alice.id, { status: 'inactive' })

    expect((await searchUsers('ali')).map(user => user.username)).toEqual([])
    expect((await searchUsers('ali', 10, true)).map(user => user.username)).toEqual(['alice'])
  })

  it('resolves inactive users when requested', async () => {
    const alice = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    await updateUser(alice.id, { status: 'inactive' })

    expect((await findUsersByUsernameOrEmail(['alice'])).map(user => user.username)).toEqual([])
    expect((await findUsersByUsernameOrEmail(['alice'], true)).map(user => user.username)).toEqual(['alice'])
  })

  it('lists only active users the user has previously shared with across their documents', async () => {
    const owner = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    const other = await createUser({ username: 'dave', email: 'dave@example.com', password: 'x' })
    const bob = await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })
    const carol = await createUser({ username: 'carol', email: 'carol@example.com', password: 'x' })
    await updateUser(carol.id, { status: 'inactive' })

    const owned = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })
    const sharedDoc = await insertDocument({ content: 'body', by: 'dave', ownerUserId: other.id })
    await setDocumentAccess(owned.id, { sharedWith: ['bob', 'carol', 'alice'] })
    await setDocumentAccess(sharedDoc.id, { sharedWith: ['bob'] })

    const sharees = await listRecentSharees(owner.id)
    expect(sharees.map(user => user.username)).toEqual(['bob'])
  })

  it('updates username, email, and password', async () => {
    const user = await createUser({ username: 'alice', email: 'alice@example.com', password: 'oldpass' })

    const updated = await updateUser(user.id, { username: 'alice2', email: 'alice2@example.com', password: 'newpass' })
    expect(updated).toMatchObject({ username: 'alice2', email: 'alice2@example.com', status: 'active' })

    expect(await findUserByCredentials('alice2', 'newpass')).toMatchObject({ id: user.id })
    expect(await findUserByCredentials('alice', 'oldpass')).toBeNull()
  })

  it('rejects updating to a duplicate username or email', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    const bob = await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })

    await expect(updateUser(bob.id, { username: 'alice' })).rejects.toThrow('already taken')
    await expect(updateUser(bob.id, { email: 'alice@example.com' })).rejects.toThrow('already taken')
  })

  it('lists users with search, sort, and pagination', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })
    await createUser({ username: 'carol', email: 'carol@example.com', password: 'x' })

    const all = await listUsers({ sortBy: 'username', order: 'asc' })
    expect(all.total).toBe(3)
    expect(all.users.map(user => user.username)).toEqual(['alice', 'bob', 'carol'])
    expect(all.users.every(user => typeof user.createdAt === 'string')).toBe(true)

    const search = await listUsers({ search: 'bo', searchKeys: ['username'] })
    expect(search.users.map(user => user.username)).toEqual(['bob'])

    const page = await listUsers({ sortBy: 'username', order: 'asc', limit: 2, offset: 0 })
    expect(page.users).toHaveLength(2)
    expect(page.hasMore).toBe(true)
    const page2 = await listUsers({ sortBy: 'username', order: 'asc', limit: 2, offset: 2 })
    expect(page2.users.map(user => user.username)).toEqual(['carol'])
    expect(page2.hasMore).toBe(false)
  })

  it('deletes a user', async () => {
    const user = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    expect(await deleteUser(user.id)).toBe(true)
    expect(await findAdminUserById(user.id)).toBeNull()
    expect(await deleteUser(user.id)).toBe(false)
  })

  it('normalizes status values', () => {
    expect(normalizeStatus('active')).toBe('active')
    expect(normalizeStatus('inactive')).toBe('inactive')
    expect(() => normalizeStatus('banned')).toThrow('status must be active or inactive')
  })
})

describe('importUsersForAdmin against the SQLite backend (dev profile)', () => {
  it('imports multiple users and verifies their credentials', async () => {
    const users = await importUsersForAdmin([
      { username: 'alice', email: 'alice@example.com', password: 's3cret' },
      { username: 'bob', email: 'bob@example.com', password: 's3cret', status: 'inactive' },
    ])

    expect(users).toHaveLength(2)
    expect(users[0]).toMatchObject({ username: 'alice', email: 'alice@example.com', status: 'active' })
    expect(users[1]).toMatchObject({ username: 'bob', email: 'bob@example.com', status: 'inactive' })

    expect(await findUserByCredentials('alice', 's3cret')).toMatchObject({ username: 'alice' })
    expect(await findUserByCredentials('bob', 's3cret')).toBeNull()
  })

  it('aborts the whole import when one record is invalid (all-or-nothing)', async () => {
    await expect(
      importUsersForAdmin([
        { username: 'alice', email: 'alice@example.com', password: 'x' },
        { username: '', email: 'bob@example.com', password: 'x' },
      ]),
    ).rejects.toThrow('record 2: username is required')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from users')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(0)
  })

  it('aborts when a username or email is already taken', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })

    await expect(
      importUsersForAdmin([
        { username: 'bob', email: 'bob@example.com', password: 'x' },
        { username: 'alice', email: 'other@example.com', password: 'x' },
      ]),
    ).rejects.toThrow('record 2: username or email is already taken')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from users')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(1)
  })

  it('rejects a missing password', async () => {
    await expect(
      importUsersForAdmin([{ username: 'alice', email: 'alice@example.com', password: '' }]),
    ).rejects.toThrow('record 1: password or passwordHash is required')
  })

  it('imports a user from a pre-hashed passwordHash and preserves the credential', async () => {
    const hash = await hashPassword('s3cret')
    const users = await importUsersForAdmin([{ username: 'alice', email: 'alice@example.com', passwordHash: hash }])

    expect(users).toHaveLength(1)
    expect(await findUserByCredentials('alice', 's3cret')).toMatchObject({ username: 'alice' })
    expect(await findUserByCredentials('alice', 'wrong')).toBeNull()
  })

  it('rejects an invalid passwordHash', async () => {
    await expect(
      importUsersForAdmin([{ username: 'alice', email: 'alice@example.com', passwordHash: 'not-a-hash' }]),
    ).rejects.toThrow('record 1: invalid passwordHash')
  })

  it('rejects a record that provides both password and passwordHash', async () => {
    await expect(
      importUsersForAdmin([
        { username: 'alice', email: 'alice@example.com', password: 'x', passwordHash: 'scrypt$c2FsdA==$aGFzaA==' },
      ]),
    ).rejects.toThrow('record 1: provide only one of password or passwordHash')
  })

  it('aborts when two records in the batch share a username', async () => {
    await expect(
      importUsersForAdmin([
        { username: 'alice', email: 'alice@example.com', password: 'x' },
        { username: 'alice', email: 'alice2@example.com', password: 'x' },
      ]),
    ).rejects.toThrow('record 2: username or email is already taken')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from users')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(0)
  })

  it('aborts when two records in the batch share an email', async () => {
    await expect(
      importUsersForAdmin([
        { username: 'alice', email: 'alice@example.com', password: 'x' },
        { username: 'bob', email: 'alice@example.com', password: 'x' },
      ]),
    ).rejects.toThrow('record 2: username or email is already taken')

    const db = await getDb()
    const count = await db.query<{ count: number | string }>('select count(*) as count from users')
    expect(Number(count.rows[0]?.count ?? 0)).toBe(0)
  })
})

describe('exportUsersForAdmin against the SQLite backend (dev profile)', () => {
  it('exports every user shaped like an import record with the password hash', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 's3cret' })
    const bob = await createUser({ username: 'bob', email: 'bob@example.com', password: 's3cret' })
    await updateUser(bob.id, { status: 'inactive' })

    const records = await exportUsersForAdmin()

    expect(records).toHaveLength(2)
    expect(records).toEqual(
      expect.arrayContaining([
        {
          username: 'alice',
          email: 'alice@example.com',
          status: 'active',
          passwordHash: expect.stringMatching(/^scrypt\$/),
        },
        {
          username: 'bob',
          email: 'bob@example.com',
          status: 'inactive',
          passwordHash: expect.stringMatching(/^scrypt\$/),
        },
      ]),
    )
    expect(records.every(record => !('password' in record))).toBe(true)
  })

  it('exports only the selected user ids', async () => {
    const alice = await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })
    const bob = await createUser({ username: 'bob', email: 'bob@example.com', password: 'x' })
    await createUser({ username: 'carol', email: 'carol@example.com', password: 'x' })

    const records = await exportUsersForAdmin([alice.id, bob.id])

    expect(records.map(record => record.username).sort()).toEqual(['alice', 'bob'])
  })

  it('returns an empty array for unknown ids and for an empty selection', async () => {
    await createUser({ username: 'alice', email: 'alice@example.com', password: 'x' })

    expect(await exportUsersForAdmin([9999])).toEqual([])
    expect(await exportUsersForAdmin([])).toHaveLength(1)
  })

  it('round-trips a user export through import preserving credentials', async () => {
    const user = await createUser({ username: 'alice', email: 'alice@example.com', password: 's3cret' })

    const exported = await exportUsersForAdmin([user.id])
    await deleteUser(user.id)

    const reimported = await importUsersForAdmin(exported)

    expect(reimported).toHaveLength(1)
    expect(reimported[0]).toMatchObject({ username: 'alice', email: 'alice@example.com', status: 'active' })
    expect(await findUserByCredentials('alice', 's3cret')).toMatchObject({ username: 'alice' })
  })
})
