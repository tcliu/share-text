// Shared SQL helpers used by both the SvelteKit server runtime and the
// standalone Node scripts. Dependency-free so the two runtimes cannot drift:
// a fix to the token rewrite or identifier quoting reaches both call sites.

// Rewrite Postgres-only tokens for SQLite. Match one token at a time so
// quoted strings, quoted identifiers, and comments pass through untouched,
// and compare case-insensitively so `BIGSERIAL` maps like `bigserial`.
const SQLITE_REWRITES = new Map([
  ['bigserial', 'integer'],
  ['current_timestamp', "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"],
])
const SQLITE_TOKEN_RE = /('(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$\d+|[A-Za-z_][A-Za-z0-9_]*)/g

export function toSqliteSql(sql) {
  return sql.replace(SQLITE_TOKEN_RE, token => {
    if (token.startsWith('$')) return '?'
    if (token[0] === "'" || token[0] === '"' || token.startsWith('--') || token.startsWith('/*')) return token
    return SQLITE_REWRITES.get(token.toLowerCase()) ?? token
  })
}

// True when a statement yields rows: a `select`/`with` query, or any statement
// with a `returning` clause. Shared by the SQLite and D1 adapters so both
// classify a statement the same way.
export function isRowsReturningSql(sql) {
  return /^\s*(select|with\b)/i.test(sql) || /returning\b/i.test(sql)
}

// Quote a Postgres identifier for DDL. Identifiers cannot be parameterized,
// so quoting is the only safe path for values that are legitimately
// interpolated. Quoted identifiers may contain any character except NUL, so
// the only unsafe input is an embedded double quote — doubled to escape it
// (`"` -> `""`).
export function quoteIdentifier(name) {
  if (typeof name !== 'string' || !name || name.includes('\u0000')) {
    throw new Error(`Invalid identifier: ${String(name)}`)
  }
  return `"${name.replace(/"/g, '""')}"`
}
