import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import { parseNonNegativeInt, parsePositiveInt, parseSearchParams } from '$lib/server/parse-query'
import { isBodyRecord } from '$lib/server/request-utils'
import {
  createUser,
  findAdminUserById,
  importUsersForAdmin,
  listUsers,
  MAX_IMPORT_RECORDS,
  normalizeStatus,
  updateUser,
  type ImportUserRecord,
} from '$lib/server/users'

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

const IMPORT_FIELDS = new Set(['username', 'email', 'password', 'status', 'passwordHash'])

async function handleImportUsers(records: unknown[], ip: string) {
  if (records.length === 0) {
    return json({ error: 'No records to import' }, { status: 400 })
  }
  if (records.length > MAX_IMPORT_RECORDS) {
    return json({ error: `Cannot import more than ${MAX_IMPORT_RECORDS} records at once` }, { status: 400 })
  }

  const input: ImportUserRecord[] = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    if (!isBodyRecord(record)) {
      return json({ error: `Record ${i + 1} must be a JSON object` }, { status: 400 })
    }
    const unsupported = Object.keys(record).filter(key => !IMPORT_FIELDS.has(key))
    if (unsupported.length > 0) {
      return json({ error: `Record ${i + 1} contains unsupported fields: ${unsupported.join(', ')}` }, { status: 400 })
    }
    input.push({
      username: typeof record.username === 'string' ? record.username : '',
      email: typeof record.email === 'string' ? record.email : '',
      password: typeof record.password === 'string' ? record.password : undefined,
      passwordHash: typeof record.passwordHash === 'string' ? record.passwordHash : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    })
  }

  const startedAt = Date.now()
  try {
    const users = await importUsersForAdmin(input)
    logEvent({
      ip,
      action: 'admin_user_import',
      details: { count: users.length, elapsed_ms: Date.now() - startedAt },
    })
    return json({ users, count: users.length }, { status: 201 })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to import users' }, { status: 400 })
  }
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const ip = getClientAddress()

  if ('records' in body) {
    if (!Array.isArray(body.records)) {
      return json({ error: 'Request body must include a records array' }, { status: 400 })
    }
    return handleImportUsers(body.records, ip)
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
    ip,
    action: 'admin_user_create',
    details: { id: created.id, username: created.username, status: created.status },
  })

  return json({ user: created }, { status: 201 })
}
