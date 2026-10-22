// Shared, dependency-free SQL helpers for the SQLite/D1 adapters (the SvelteKit
// server runtime) and the standalone schema/deploy scripts, so the two share one
// implementation and cannot drift: the token rewrite, parameter coercion, and
// identifier quoting are defined once.

// Postgres-only tokens rewritten for SQLite, matched one token at a time so
// quoted strings, quoted identifiers, and comments pass through untouched, and
// compared case-insensitively so `BIGSERIAL` maps like `bigserial`. The zero-arg
// `now()` call maps to the same UTC ISO expression as `current_timestamp`, so the
// two default spellings agree.
export const SQLITE_NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
const SQLITE_REWRITES = new Map([
  ['bigserial', 'integer'],
  ['current_timestamp', SQLITE_NOW],
])
const SQLITE_TOKEN_RE =
  /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$\d+|\bnow\s*\(\s*\)|[A-Za-z_][A-Za-z0-9_]*/gi
const NOW_CALL_RE = /^now\s*\(\s*\)$/i

// One token walk shared by both entry points: `placeholder(token)` renders each
// `$n` occurrence, so `toSqliteSql` (unbound DDL) and `toSqliteQuery` (bound
// values) rewrite identically.
function translate(sql, placeholder) {
  return sql.replace(SQLITE_TOKEN_RE, token => {
    if (token.startsWith('$')) return placeholder(token)
    if (token[0] === "'" || token[0] === '"' || token.startsWith('--') || token.startsWith('/*')) return token
    if (NOW_CALL_RE.test(token)) return SQLITE_NOW
    return SQLITE_REWRITES.get(token.toLowerCase()) ?? token
  })
}

// Rewrite Postgres-only tokens and `$n` placeholders for SQLite statements
// whose values are not bound (e.g. schema application).
export function toSqliteSql(sql) {
  return translate(sql, () => '?')
}

// Coerce a bound value to a SQLite-accepted primitive: booleans as 0/1, Dates as
// ISO-8601 strings, and `undefined` as null (both better-sqlite3 and D1 reject an
// unbound undefined).
export function toSqliteParam(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  if (value === undefined) return null
  return value
}

// True when a statement yields rows: a `select`/`with` query, or any statement
// with a `returning` clause, so both adapters classify a statement the same way.
export function isRowsReturningSql(sql) {
  return /^\s*(select|with\b)/i.test(sql) || /returning\b/i.test(sql)
}

// SQLite query text plus its per-occurrence bound values: emit the value once per
// `$n` occurrence so a repeated `$n` binds twice, matching the positional `?`
// rewrite (see `~/.agents/references/sql.md`, Parameters). Values are coerced
// through `toSqliteParam` so callers bind them directly.
export function toSqliteQuery(sql, params = []) {
  const values = []
  const text = translate(sql, token => {
    values.push(toSqliteParam(params[Number(token.slice(1)) - 1]))
    return '?'
  })
  return { text, values }
}

// Quote a Postgres identifier for DDL. Identifiers cannot be parameterized, so
// quoting is the only safe path for values that are legitimately interpolated.
// Quoted identifiers may contain any character except NUL, so the only unsafe
// input is an embedded double quote — doubled to escape it (`"` -> `""`).
export function quoteIdentifier(name) {
  if (typeof name !== 'string' || !name || name.includes('\u0000')) {
    throw new Error(`Invalid identifier: ${String(name)}`)
  }
  return `"${name.replace(/"/g, '""')}"`
}
