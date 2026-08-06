import type { PageServerLoad } from './$types'
import { getMaxContentLength } from '$lib/server/settings'

export const load: PageServerLoad = async () => {
  return { maxContentLength: await getMaxContentLength() }
}
