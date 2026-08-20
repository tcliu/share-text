import { vi } from 'vitest'

export const goto = vi.fn(async () => {})
export const replaceState = vi.fn()
export const beforeNavigate = vi.fn()
export const afterNavigate = vi.fn()
export const invalidate = vi.fn()
export const invalidateAll = vi.fn()
