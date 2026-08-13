// @vitest-environment node
process.env.PROFILE = 'dev'
process.env.SQLITE_PATH = ':memory:'

import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '$lib/server/db'
import {
  claimAnonymousDocuments,
  fetchDocumentSummaries,
  getDocumentAccess,
  insertDocument,
  resolveDocumentAccess,
  setDocumentAccess,
} from '$lib/server/documents'
import { createUser, type User } from '$lib/server/users'
import type { Viewer } from '$lib/server/viewer'

const anonymous = (ip: string): Viewer => ({ type: 'anonymous', userId: null, username: null, ip, name: ip })
const userViewer = (user: User, ip = '10.0.0.99'): Viewer => ({
  type: 'user',
  userId: user.id,
  username: user.username,
  ip,
  name: user.username,
})

beforeEach(async () => {
  const db = await getDb()
  await db.query('delete from documents')
  await db.query('delete from users')
})

describe('resolveDocumentAccess', () => {
  it('lets an anonymous creator view, edit, and delete their own public document', async () => {
    const doc = await insertDocument({ content: 'body', by: '10.0.0.1' })

    const access = await resolveDocumentAccess(doc.id, anonymous('10.0.0.1'))

    expect(access.canView).toBe(true)
    expect(access.canEdit).toBe(true)
    expect(access.canDelete).toBe(true)
    expect(access.canManageAccess).toBe(false)
  })

  it('lets an anonymous viewer see but not edit a public document they do not own', async () => {
    const doc = await insertDocument({ content: 'body', by: '10.0.0.1' })

    const access = await resolveDocumentAccess(doc.id, anonymous('10.0.0.2'))

    expect(access.canView).toBe(true)
    expect(access.canEdit).toBe(false)
    expect(access.canDelete).toBe(false)
  })

  it('gives the owning user full access including manage', async () => {
    const user = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: user.id })

    const access = await resolveDocumentAccess(doc.id, userViewer(user))

    expect(access.canView).toBe(true)
    expect(access.canEdit).toBe(true)
    expect(access.canDelete).toBe(true)
    expect(access.canManageAccess).toBe(true)
  })

  it('lets any user edit a public document but not delete it', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const other = await createUser({ username: 'bob', email: 'b@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })

    const access = await resolveDocumentAccess(doc.id, userViewer(other))

    expect(access.canView).toBe(true)
    expect(access.canEdit).toBe(true)
    expect(access.canDelete).toBe(false)
    expect(access.canManageAccess).toBe(false)
  })

  it('lets a shared user edit a private document but not delete or manage it', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const other = await createUser({ username: 'bob', email: 'b@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })
    await setDocumentAccess(doc.id, { isPublic: false, sharedWith: ['bob'] })

    const access = await resolveDocumentAccess(doc.id, userViewer(other))

    expect(access.canView).toBe(true)
    expect(access.canEdit).toBe(true)
    expect(access.canDelete).toBe(false)
    expect(access.canManageAccess).toBe(false)
  })

  it('hides a private document from anonymous and unrelated users', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const other = await createUser({ username: 'bob', email: 'b@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })
    await setDocumentAccess(doc.id, { isPublic: false })

    expect((await resolveDocumentAccess(doc.id, anonymous('10.0.0.1'))).canView).toBe(false)
    expect((await resolveDocumentAccess(doc.id, userViewer(other))).canView).toBe(false)
    expect((await resolveDocumentAccess(doc.id, userViewer(owner))).canView).toBe(true)
  })

  it('returns null document for an unknown id', async () => {
    const access = await resolveDocumentAccess('zzzzzz', anonymous('10.0.0.1'))

    expect(access.document).toBeNull()
    expect(access.canView).toBe(false)
  })
})

describe('fetchDocumentSummaries visibility', () => {
  it('shows anonymous viewers only public documents', async () => {
    const user = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const publicDoc = await insertDocument({ name: 'public', content: '', by: '10.0.0.1' })
    const privateDoc = await insertDocument({ name: 'private', content: '', by: 'alice', ownerUserId: user.id })
    await setDocumentAccess(privateDoc.id, { isPublic: false })

    const summaries = await fetchDocumentSummaries({ viewer: anonymous('10.0.0.2') })

    expect(summaries.documents.map(summary => summary.id)).toEqual([publicDoc.id])
  })

  it('shows a user public, owned, and shared documents', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const other = await createUser({ username: 'bob', email: 'b@example.com', password: 'x' })
    const publicDoc = await insertDocument({ name: 'public', content: '', by: '10.0.0.1' })
    const ownedPrivate = await insertDocument({ name: 'owned', content: '', by: 'alice', ownerUserId: owner.id })
    const sharedPrivate = await insertDocument({ name: 'shared', content: '', by: 'bob', ownerUserId: other.id })
    await setDocumentAccess(ownedPrivate.id, { isPublic: false })
    await setDocumentAccess(sharedPrivate.id, { isPublic: false, sharedWith: ['alice'] })

    const summaries = await fetchDocumentSummaries({ viewer: userViewer(owner) })
    const ids = summaries.documents.map(summary => summary.id).sort()

    expect(ids).toEqual([publicDoc.id, ownedPrivate.id, sharedPrivate.id].sort())

    const ownedSummary = summaries.documents.find(summary => summary.id === ownedPrivate.id)
    expect(ownedSummary?.owned).toBe(true)
    expect(ownedSummary?.editable).toBe(true)

    const sharedSummary = summaries.documents.find(summary => summary.id === sharedPrivate.id)
    expect(sharedSummary?.owned).toBe(false)
    expect(sharedSummary?.editable).toBe(true)
  })
})

describe('document access state', () => {
  it('round-trips public flag and share list', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const bob = await createUser({ username: 'bob', email: 'b@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })

    await setDocumentAccess(doc.id, { isPublic: false, sharedWith: ['bob'] })

    const state = await getDocumentAccess(doc.id)
    expect(state?.isPublic).toBe(false)
    expect(state?.sharedWith.map(user => user.username)).toEqual(['bob'])

    await setDocumentAccess(doc.id, { isPublic: true })
    const publicState = await getDocumentAccess(doc.id)
    expect(publicState?.isPublic).toBe(true)
  })

  it('ignores the owner when sharing with themselves', async () => {
    const owner = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const doc = await insertDocument({ content: 'body', by: 'alice', ownerUserId: owner.id })

    await setDocumentAccess(doc.id, { sharedWith: ['alice'] })

    const state = await getDocumentAccess(doc.id)
    expect(state?.sharedWith).toEqual([])
  })
})

describe('claimAnonymousDocuments', () => {
  it('transfers same-IP anonymous documents to the user', async () => {
    const user = await createUser({ username: 'alice', email: 'a@example.com', password: 'x' })
    const mine = await insertDocument({ name: 'mine', content: '', by: '10.0.0.1' })
    const otherIp = await insertDocument({ name: 'other', content: '', by: '10.0.0.2' })

    await claimAnonymousDocuments('10.0.0.1', user)

    const access = await resolveDocumentAccess(mine.id, userViewer(user, '10.0.0.1'))
    expect(access.canDelete).toBe(true)
    expect(access.canManageAccess).toBe(true)

    const otherAccess = await resolveDocumentAccess(otherIp.id, userViewer(user, '10.0.0.1'))
    expect(otherAccess.canDelete).toBe(false)
  })
})
