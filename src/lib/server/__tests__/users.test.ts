// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  createUser,
  findUserByCredentials,
  findUserById,
  normalizeEmail,
  normalizeUsername,
  searchUsers,
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
})
