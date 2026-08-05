# Share Text Agent Conventions

## Development Guide

Read this `AGENTS.md` and the applicable shared reference files under `$AI_CONFIG_DIR/references/*.md` before writing or reviewing code. When reviewing code, follow the `code-review` skill definition, reporting findings with severity, location, rule, and fix.

## Project conventions

- Server persistence goes through the `Db` interface (`src/lib/server/db-types.ts`), writing engine-agnostic SQL with `$n` placeholders and `current_timestamp` so DDL stays portable across adapters.
- Mutations are logged via `$lib/server/logging` with key identifying info (document id, name, size, IP, `elapsed_ms`).

## Keeping references in sync

- When a code change establishes or revises a project-specific convention, update this `AGENTS.md` in the same change.
- When a code change establishes or revises a generic reusable convention, update the appropriate file under `$AI_CONFIG_DIR/references/` in the same change rather than duplicating it here.

## Quality checks

Run before finishing any change:

```bash
npm run check
npm run build
npm test
```
