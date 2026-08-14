import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import { isBodyRecord } from '$lib/server/request-utils'
import { deleteUser, findAdminUserById, normalizeStatus, updateUser } from '$lib/server/users'

function parseUserId(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
  const id = parseUserId(params.id)
  if (!id) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }

  const changes: { username?: string; email?: string; password?: string; status?: 'active' | 'inactive' } = {}
  if (typeof body.username === 'string') {
    changes.username = body.username
  }
  if (typeof body.email === 'string') {
    changes.email = body.email
  }
  if (typeof body.password === 'string') {
    changes.password = body.password
  }
  if (typeof body.status === 'string') {
    try {
      changes.status = normalizeStatus(body.status)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid status' }, { status: 400 })
    }
  }
  if (
    changes.username === undefined &&
    changes.email === undefined &&
    changes.password === undefined &&
    changes.status === undefined
  ) {
    return json({ error: 'Request body must include a username, email, password, or status' }, { status: 400 })
  }

  const existing = await findAdminUserById(id)
  if (!existing) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  let updated
  try {
    updated = await updateUser(id, changes)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user'
    if (message === 'username or email is already taken') {
      return json({ error: message }, { status: 409 })
    }
    return json({ error: message }, { status: 400 })
  }
  if (!updated) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  const result = await findAdminUserById(id)
  if (!result) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  const details: Record<string, string | number | boolean> = { id }
  if (changes.username !== undefined) {
    details.old_username = existing.username
    details.new_username = result.username
  }
  if (changes.email !== undefined) {
    details.old_email = existing.email
    details.new_email = result.email
  }
  if (changes.status !== undefined) {
    details.old_status = existing.status
    details.new_status = result.status
  }
  if (changes.password !== undefined) {
    details.password_reset = true
  }
  const action = changes.status !== undefined
    ? 'admin_user_update_status'
    : changes.password !== undefined
      ? 'admin_user_update_password'
      : changes.username !== undefined
        ? 'admin_user_update_username'
        : 'admin_user_update_email'
  logEvent({ ip: getClientAddress(), action, details })

  return json({ user: result })
}

export const DELETE: RequestHandler = async ({ params, getClientAddress }) => {
  const id = parseUserId(params.id)
  if (!id) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  const existing = await findAdminUserById(id)
  if (!existing) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  const deleted = await deleteUser(id)
  if (!deleted) {
    return json({ error: 'User not found' }, { status: 404 })
  }

  logEvent({
    ip: getClientAddress(),
    action: 'admin_user_delete',
    details: { id, username: existing.username, email: existing.email },
  })

  return new Response(null, { status: 204 })
}
