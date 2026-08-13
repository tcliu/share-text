import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { isDocumentKeyChars, resolveDocumentAccess } from '$lib/server/documents'
import { getMaxContentLength } from '$lib/server/settings'
import { resolveViewer } from '$lib/server/viewer'

export const load: PageServerLoad = async ({ params, cookies, getClientAddress }) => {
  const id = params.id
  if (!isDocumentKeyChars(id)) {
    throw error(404, 'Document not found')
  }
  const viewer = await resolveViewer({ cookies, getClientAddress })
  const access = await resolveDocumentAccess(id, viewer)
  if (!access.document || !access.canView) {
    throw error(404, 'Document not found')
  }
  return {
    document: access.document,
    editable: access.canEdit,
    owned: access.canDelete,
    canManageAccess: access.canManageAccess,
    maxContentLength: await getMaxContentLength(),
  }
}
