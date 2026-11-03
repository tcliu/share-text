import type { RequestHandler } from './$types'
import { isAdminSession, isAdminConfigured } from '#lib/server/admin-auth.js'

export const GET: RequestHandler = async ({ cookies }) => {
  return Response.json({
    authenticated: isAdminSession({ cookies }),
    configured: await isAdminConfigured(),
  })
}
