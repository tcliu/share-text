import type { RequestEvent } from '@sveltejs/kit'
import { USER_SESSION_COOKIE, verifyUserSessionToken } from './user-auth'
import { findUserById } from './users'

export type Viewer =
  | { type: 'anonymous'; userId: null; username: null; ip: string; name: string }
  | { type: 'user'; userId: number; username: string; ip: string; name: string }

export async function resolveViewer(
  event: Pick<RequestEvent, 'cookies' | 'getClientAddress'>,
): Promise<Viewer> {
  const ip = event.getClientAddress()
  const userId = verifyUserSessionToken(event.cookies.get(USER_SESSION_COOKIE))
  if (userId === null) {
    return { type: 'anonymous', userId: null, username: null, ip, name: ip }
  }
  const user = await findUserById(userId)
  if (!user) {
    return { type: 'anonymous', userId: null, username: null, ip, name: ip }
  }
  return { type: 'user', userId: user.id, username: user.username, ip, name: user.username }
}
