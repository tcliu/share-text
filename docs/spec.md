# Specification

This document describes the implementation and architecture of `share-text`.

## Overview

SvelteKit app in a `(browser)` route group. The server persists documents to
either SQLite or PostgreSQL depending on the resolved `PROFILE`; the client
synchronizes through a small fetch-based JSON API.

## Routing

- `/` — empty-state page prompting the user to select or create a document.
- `/{doc-id}` — the editor. `[id]/+page.server.ts` validates the id against the
  six-character `^[0-9a-z]{6}$` key format and throws a 404 when invalid or when
  the document does not exist; the page component renders server data, then
  re-fetches the document client-side on refresh.
- `/api/documents` — `GET` returns summaries of the documents created by the
  requesting client IP (`created_by`); `POST` creates a document (201) and
  enforces the per-IP create limit.
- `/api/documents/[id]` — `GET` returns one document; `PUT` updates `name`,
  `content`, or both and returns the updated document; `DELETE` removes it
  (204). Validation failures return 400, unknown ids 404.

## Data Layer

- `src/lib/server/documents.ts` holds all persistence logic with
  engine-agnostic SQL using `$n` placeholders and `current_timestamp`.
- `db.ts` resolves the `PROFILE` and returns the matching `Db` adapter (the
  small `query`/`close` interface in `db-types.ts`):
  - `db-sqlite.ts` uses Node's built-in `node:sqlite` (`DatabaseSync`) and
    rewrites `$n` → `?`, `bigserial` → `integer`, and `current_timestamp` → a
    UTC ISO `strftime` expression. The dev database file is auto-created and the
    schema applied on first start.
  - `db-pg.ts` uses a `pg` connection `Pool` configured from `DATABASE_URL`.
- `sql/schema.sql` (idempotent) defines the `documents` table (`id` sequence,
  public `key`, `name`, `content`, `created_by`/`updated_by` IPs,
  `created_at`/`updated_at`) and the `idx_documents_updated_at` index.
- Document keys are six characters from `0-9a-z` generated with rejection
  sampling over `crypto` random bytes.

## Limits

- `MAX_DOCUMENTS_PER_IP` (default 10) caps how many documents a single client IP
  can create (`created_by`); exceeding it returns 403.
- Content is capped at a hard 1 MB byte limit plus `MAX_CONTENT_LENGTH` (default
  1048576) characters; both are enforced on create and update. Names are
  trimmed, required, and limited to 200 characters.
- Default names (`Untitled`, `Untitled 2`, ...) are computed server-side against
  the existing names.

## Client State

- `src/lib/documents.ts` is the fetch-based API client.
- `document-drafts.ts` wraps `localStorage` for per-document drafts, guarded
  against SSR and storage/quota errors.
- `share-text-context.ts` exposes a Svelte context through which the shell
  shares the document list, refresh/create/delete operations, a
  selected-document refresh token, and editor dirty-state guard registration.
- `(browser)/+layout.svelte` is the shell: it owns the document list (loaded in
  pages), runs `beforeNavigate` through the dirty guard, and hosts the discard
  and delete confirm dialogs. Deleting the currently selected document navigates
  to `/`.

## Editor

- The editor is CodeMirror 6, lazy-loaded via `LazyCodeEditor` (dynamic
  `import()`) so the initial route bundle stays small. A transaction filter caps
  document length at `maxContentLength`.

## Concurrency

Writes are last-write-wins with no conflict detection or merge.

## Scripts

- `scripts/apply-schema.mjs` applies `sql/schema.sql` to the dev SQLite database
  or, under `PROFILE=prod`, to the PostgreSQL database.
- `scripts/db-config.mjs` centralizes env-file parsing, profile resolution, and
  the SQLite SQL rewrite for scripts.
- `scripts/sync-vercel-env.mjs` merges `.env` and `.env.vercel`, upserts the set
  to Vercel production env vars, and removes stale ones.
- `scripts/deploy.sh` deploys to Vercel, waits for `READY`, and syncs the
  project's production domain to `APP_BASE_URL`.
