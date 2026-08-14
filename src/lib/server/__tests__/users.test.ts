// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  createUser,
  deleteUser,
  findAdminUserById,
  findUserByCredentials,
  findUserById,
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
    const resolved = await (await import('$lib/server/users')).findUsersByUsernameOrEmail(['alice', 'bob'])
    expect(resolved.map(user => user.username)).toEqual(['bob'])
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
