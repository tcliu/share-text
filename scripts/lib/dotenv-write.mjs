#!/usr/bin/env node
// lib/dotenv-write.mjs — comment-preserving KEY=value edits for dotenv files.
// One implementation backs both callers: the overlay upsert used by the deploy
// flow (no dedupe) and the worktree-local editor (dedupe + delete).
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Line-preserving KEY=value upsert: an existing uncommented entry is replaced
// in place (comments and ordering untouched), otherwise the entry is appended.
// Options switch on the worktree editor's extra behavior:
//   dedupe    — collapse later duplicate entries into the first write
//   removeNull — a null `value` removes the entry instead of writing it
//   crlf      — split on \r?\n (normalizing CRLF) instead of \n
//   trimTail  — strip trailing whitespace and collapse blank lines on output
// Always ends the file with exactly one newline.
export function writeEnvLine(
  content,
  key,
  value,
  { dedupe = false, removeNull = false, crlf = false, trimTail = false } = {},
) {
  const lines = String(content ?? '').split(crlf ? /\r?\n/ : '\n')
  if (!crlf && lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`)
  const removing = removeNull && value === null
  const out = []
  let done = false
  for (const line of lines) {
    if (pattern.test(line) && !line.trimStart().startsWith('#')) {
      if (removing) continue
      if (done && dedupe) continue
      if (!done) {
        out.push(`${key}=${value}`)
        done = true
      } else {
        out.push(line)
      }
      continue
    }
    out.push(line)
  }
  if (!removing && !done) {
    if (trimTail) {
      while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()
    }
    out.push(`${key}=${value}`)
  }
  const joined = out.join('\n')
  return `${trimTail ? joined.replace(/\s*$/, '') : joined}\n`
}
