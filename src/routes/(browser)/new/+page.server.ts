import type { PageServerLoad } from './$types'
import { getMaxContentLength } from '$lib/server/admin-properties'

export const load: PageServerLoad = async () => {
  return { maxContentLength: await getMaxContentLength() }
}
