import { isDocumentKeyChars } from '$lib/server/documents'

export function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function parseDocumentId(value: string | undefined) {
  if (!value || !isDocumentKeyChars(value)) {
    return null
  }
  return value
}
