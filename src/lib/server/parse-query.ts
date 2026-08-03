export function parsePositiveInt(value: string | null) {
  if (value === null) {
    return null
  }
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseNonNegativeInt(value: string | null) {
  if (value === null) {
    return 0
  }
  if (!/^\d+$/.test(value)) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
