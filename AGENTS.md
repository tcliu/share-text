# Share Text Agent Conventions

## Development Guide

Write and review code against this `AGENTS.md` and the applicable reference documents below. When reviewing code, follow the `code-review` skill definition, reporting findings with severity, location, rule, and fix.

## Reference documents

Apply the reference documents in `AI_CONFIG_DIR/references/` (shared with `../ai`, i.e. the AI conventions workspace). The references that apply to this project:

- `svelte.md` — Svelte 5 runes, server/client boundaries, component conventions, lazy loading, composable extraction.
- `js-ts.md` — JavaScript/TypeScript code style.
- `sql.md` — SQL/PostgreSQL schema conventions (lowercase keywords, index naming, separate `create index`).
- `api-client.md` — fetch-based API client conventions and error handling.
- `reliability.md` — state safety, async flows, concurrency, event logging.
- `ui-patterns.md` — UI and interaction conventions.
- `bash.md` — shell scripting conventions for scripts.

Read the applicable reference file when writing or reviewing code in the covered area, and verify its rules.

## Project conventions

- Server persistence goes through the `Db` interface (`src/lib/server/db-types.ts`) with engine-agnostic SQL: use `$n` placeholders and `current_timestamp`, and keep schema DDL portable (the SQLite adapter rewrites `$n` → `?`, `bigserial` → `integer`, and `current_timestamp` → a UTC ISO `strftime` expression).
- `localStorage` helpers guard against SSR (`typeof localStorage === 'undefined'`) and storage/quota errors, falling back to in-memory state.

## Quality checks

Run before finishing any change:

```bash
npm run check
npm run build
npm test
```
