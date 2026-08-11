function pad(value: number) {
  return String(value).padStart(2, '0')
}

/**
 * Formats an ISO timestamp as `YYYY-MM-DD HH:MM:SS` in local time, passing
 * through unparseable values unchanged.
 */
export function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
