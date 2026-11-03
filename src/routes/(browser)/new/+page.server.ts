import type { PageServerLoad } from './$types'
import { getMaxContentLength } from '#lib/server/admin-properties.js'

export const load: PageServerLoad = async () => {
  return { maxContentLength: await getMaxContentLength() }
}
