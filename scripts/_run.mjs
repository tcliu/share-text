#!/usr/bin/env node

// _run.mjs — shared command echoing for CLI scripts. Every external command
// is printed before it runs so logs show what executed; values supplied under
// secret-keyed flags are masked so credentials never reach the log.
// A key whose segments include a secret word is masked before echo. `key` is
// boundary-scoped, so `MONKEY` stays visible while `api-key` and `ACCESS_KEY`
// do not; ordinary values are never masked.
const SECRET_KEY_RE = /(^|[_-])(secret|password|passwd|token|credential|private|database_url|api_?key|access_?key|key)([_-]|$)/i
const MASK = '***'

const isSecretFlag = (arg) =>
  /^--?/.test(arg) && SECRET_KEY_RE.test(arg.replace(/^--?/, ''))

function maskArgument(arg) {
  const separator = arg.indexOf('=')
  return separator === -1 ? arg : `${arg.slice(0, separator)}=${MASK}`
}

// Mask a single inline `--key=value` token; used by callers that render one
// argument at a time (e.g. the worktree TUI's git echo).
export function maskArgToken(arg) {
  const separator = arg.indexOf('=')
  if (separator <= 0) return arg
  const key = arg.slice(0, separator)
  return isSecretFlag(key) ? `${key}=${'*'.repeat(8)}` : arg
}

export function formatCommand(command, args = []) {
  const parts = [command]
  let maskNext = false
  for (const arg of args) {
    if (maskNext) {
      parts.push(MASK)
      maskNext = false
    } else if (typeof arg === 'string' && isSecretFlag(arg)) {
      const hasInlineValue = arg.includes('=')
      parts.push(hasInlineValue ? maskArgument(arg) : arg)
      maskNext = !hasInlineValue
    } else {
      parts.push(arg)
    }
  }
  return parts.join(' ')
}

export function echoCommand(command, args = []) {
  console.error(`$ ${formatCommand(command, args)}`)
}
