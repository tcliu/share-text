export function isUniqueViolation(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const code = (error as Error & { code?: unknown }).code
  if (code === '23505') {
    return true
  }
  const errcode = (error as Error & { errcode?: unknown }).errcode
  if (errcode === 2067) {
    return true
  }
  return error.message.includes('UNIQUE constraint failed')
}
