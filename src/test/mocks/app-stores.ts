import { writable } from 'svelte/store'

export const page = writable({ params: {}, url: new URL('http://localhost/'), route: { id: '/[id]' } })
export const navigating = writable(null)
export const updated = writable(false)

export function setPage(value: Record<string, unknown>) {
  page.set(value as never)
}
