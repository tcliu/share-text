#!/usr/bin/env node

// _run.mjs — shared command echoing for CLI scripts. Every external command
// is printed before it runs so logs show what executed; secret values are
// masked so credentials never reach the log. Masked: the value after a
// secret-keyed flag, an inline `--key=value`, a bare `NAME=value` whose name
// names a secret, and the `--value` of an `env add <KEY>` (only when <KEY> is
// absent, a flag, or itself secret — fail closed). `key` is boundary-scoped, so
// `MONKEY` stays visible while `api-key` and `ACCESS_KEY` do not; ordinary
// values are never masked.
const SECRET_KEY_RE = /(^|[_-])(secret|password|passwd|token|credential|private|database_url|api_?key|access_?key|key)([_-]|$)/i
const MASK = '***'

const isSecretFlag = (arg) => {
  if (!/^--?/.test(arg)) return false
  // Test the key alone: an inline `--token=abc` form appends the value, which
  // would otherwise hide the trailing boundary the pattern needs.
  const key = arg.replace(/^--?/, '').split('=')[0]
  return SECRET_KEY_RE.test(key)
}

function maskArgument(arg) {
  const separator = arg.indexOf('=')
  return separator === -1 ? arg : `${arg.slice(0, separator)}=${MASK}`
}

// A positional name (env key) whose segments include a secret word.
const isSecretName = (name) => SECRET_KEY_RE.test(String(name))

// Mask a token list: the value after a secret-keyed flag, an inline
// `--key=value` secret, and the `--value` of an `add <KEY>` — the value is only
// secret when the key is, so fail closed when the key is absent or a flag.
function maskTokens(tokens) {
  const addAt = tokens.indexOf('add')
  const addKey = addAt >= 0 && addAt + 1 < tokens.length ? tokens[addAt + 1] : ''
  const addKeySecret = addAt < 0 || !addKey || String(addKey).startsWith('-') || isSecretName(addKey)
  const out = []
  let maskNext = false
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (maskNext) {
      maskNext = false
      out.push(MASK)
      continue
    }
    if (isSecretFlag(token)) {
      const hasInlineValue = token.includes('=')
      out.push(hasInlineValue ? maskArgument(token) : token)
      maskNext = !hasInlineValue
      continue
    }
    if (addKeySecret && token.startsWith('--value=')) {
      out.push(maskArgument(token))
      continue
    }
    if (addKeySecret && token === '--value' && i + 1 < tokens.length) {
      out.push(token, MASK)
      i += 1
      continue
    }
    // A bare `NAME=value` assignment (e.g. typed at the worktree prompt): mask
    // the value only when NAME itself names a secret.
    if (token.includes('=')) {
      const name = token.slice(0, token.indexOf('='))
      if (isSecretName(name)) {
        out.push(maskArgument(token))
        continue
      }
    }
    out.push(token)
  }
  return out
}

// Mask a shell command string for the worktree TUI, which renders one line
// rather than an argv array. Whitespace is preserved so the echoed line stays
// identical apart from masked values; a masked secret that opens a quoted span
// also masks the remaining whitespace-separated fragments up to its closing
// quote (display-only best effort on the operator's own command).
export function maskCommandLine(line) {
  const parts = line.split(/(\s+)/)
  const tokens = parts.filter(part => !/^\s*$/.test(part))
  const masked = maskTokens(tokens)
  // An odd number of double quotes means the token opens a quoted value whose
  // closing quote sits in a later whitespace-separated token.
  const opensQuote = token => ((token.match(/"/g) ?? []).length % 2 === 1)
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === tokens[i] || !opensQuote(tokens[i])) continue
    let last = i
    for (let j = i + 1; j < masked.length; j++) {
      masked[j] = MASK
      last = j
      if (tokens[j].endsWith('"')) break
    }
    // Skip the span just masked so the extension cannot re-trigger on a
    // fragment whose closing quote still reads as an opening one.
    i = last
  }
  let cursor = 0
  return parts.map(part => (/^\s*$/.test(part) ? part : masked[cursor++])).join('')
}

export function formatCommand(command, args = []) {
  return [command, ...maskTokens(args)].join(' ')
}

export function echoCommand(command, args = []) {
  console.error(`$ ${formatCommand(command, args)}`)
}
