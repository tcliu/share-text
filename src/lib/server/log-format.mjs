// Shared, dependency-free log-line formatter.
//
// Both runtimes emit the same `<ISO timestamp> <LEVEL> ip=<ip> action=<action>
// <key>=<JSON>` shape: the server helper (`src/lib/server/logging.ts`) and the
// operational scripts (`scripts/log-event.mjs`). Keeping the format here means
// a format change lands once instead of being mirrored by hand. It is plain
// `.mjs` so the Node scripts can import it directly while the app bundles the
// same implementation.
//
// Never pass connection strings, secrets, passwords, or document contents —
// only identifiers and counts.
/**
 * @param {{ action: string, ip?: string, details?: Record<string, unknown> }} input
 * @returns {string}
 */
export function formatLogLine({ action, ip, details = {} }) {
  const timestamp = new Date().toISOString()
  const defaultLevel = action.endsWith('_error') ? 'ERROR' : 'INFO'
  const { level, ...rest } = details
  const resolvedLevel = level === 'INFO' || level === 'WARN' || level === 'ERROR' ? level : defaultLevel
  const serializedDetails = Object.entries(rest)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ')
  return `${timestamp} ${resolvedLevel} ip=${ip || 'unknown'} action=${action}${
    serializedDetails ? ` ${serializedDetails}` : ''
  }`
}

/**
 * Message from an unknown thrown value, for an event's `error` detail. Shared by
 * both runtimes so a script and the server describe the same failure the same way.
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = /** @type {{ message?: unknown }} */ (error).message
    if (typeof message === 'string' && message) {
      return message
    }
  }
  return String(error)
}
