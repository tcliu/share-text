import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import { parseNonNegativeInt, parsePositiveInt, parseSearchParams } from '$lib/server/parse-query'
import { isBodyRecord } from '$lib/server/request-utils'
import { createUser, findAdminUserById, listUsers, normalizeStatus, updateUser } from '$lib/server/users'

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')
  const { search, searchKeys } = parseSearchParams(url)
  const sortBy = (url.searchParams.get('sortBy') ?? '').trim().slice(0, 50)
  const orderParam = url.searchParams.get('order')

  const limit = limitParam === null ? undefined : parsePositiveInt(limitParam)
  const offset = parseNonNegativeInt(offsetParam)

  if ((limitParam !== null && limit === null) || offset === null) {
    return json({ error: 'Invalid pagination parameters' }, { status: 400 })
  }

  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : undefined

  const { users, total, hasMore } = await listUsers({
    search,
    searchKeys,
    limit: limit !== null ? limit : undefined,
    offset,
    sortBy: sortBy || undefined,
    order,
  })

  return json({ users, total, hasMore })
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const status = typeof body.status === 'string' ? body.status : 'active'

  let normalizedStatus
  try {
    normalizedStatus = normalizeStatus(status)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid status' }, { status: 400 })
  }

  let user
  try {
    user = await createUser({ username, email, password })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user'
    if (message === 'username or email is already taken') {
      return json({ error: message }, { status: 409 })
    }
    return json({ error: message }, { status: 400 })
  }

  if (normalizedStatus === 'inactive') {
    await updateUser(user.id, { status: normalizedStatus })
  }

  const created = await findAdminUserById(user.id)
  if (!created) {
    return json({ error: 'Failed to create user' }, { status: 500 })
  }

  logEvent({
    ip: getClientAddress(),
    action: 'admin_user_create',
    details: { id: created.id, username: created.username, status: created.status },
  })

  return json({ user: created }, { status: 201 })
}
