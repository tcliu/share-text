import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import { resolveViewer } from '$lib/server/viewer'

export const load: LayoutServerLoad = async event => {
  const viewer = await resolveViewer(event)
  if (viewer.type === 'admin') {
    throw redirect(307, '/admin')
  }
  if (viewer.type !== 'user') {
    throw redirect(307, '/login')
  }
  return { viewer }
}