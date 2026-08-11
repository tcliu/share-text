# Specification

This document describes the implementation and architecture of `share-text`.

## Overview

SvelteKit app in a `(browser)` route group. The server persists documents to
either SQLite or PostgreSQL depending on the resolved `PROFILE`; the client
synchronizes through a small fetch-based JSON API.

## Routing

- `/` — empty-state page prompting the user to select or create a document.
- `/new` — the new-document draft page. The load supplies `maxContentLength`;
  the page manages its own draft (`share-text:draft:new`), validates on save,
  creates the document, and navigates to `/{id}`.
- `/{doc-id}` — the editor. `[id]/+page.server.ts` validates the id against the
  `^[0-9a-z]+$` key character set and throws a 404 when invalid or when
  the document does not exist; the page component renders server data, then
  re-fetches the document client-side on refresh.
- `/api/documents` — `GET` returns paginated summaries (`limit`/`offset`,
  `hasMore`) of every document across all client IPs, with an optional
  server-side search (`search`, scoped to `search-keys`); each summary carries
  an `owned` flag set when `created_by` matches the requesting client IP (used
  by the UI to gate the row delete button). `POST` creates a document (201) and
  enforces the per-IP create limit.
- `/api/documents/[id]` — `GET` returns one document; `PUT` updates `name`,
  `content`, `documentType`, `tags`, or any combination thereof and returns
  the updated document; `DELETE` removes it (204). Validation failures return
  400, unknown ids 404. A `PUT` that changes `content` or `documentType`
  records a content-version snapshot.
- `/api/documents/[id]/versions` — `GET` returns the saved content versions
  for a document, newest first (metadata only: id, type, author, size,
  timestamp). `/api/documents/[id]/versions/[versionId]` — `GET` returns one
  version including its content.
- `/api/admin/login` — `POST` verifies admin credentials, sets an HTTP-only
  signed session cookie, and is rate-limited per IP. `/api/admin/logout`
  clears the cookie. `/api/admin/session` reports whether admin is configured
  and whether the caller is authenticated.
- `/api/admin/settings` — `GET` returns resolved application properties with
  their source; `PUT` accepts `{ settings: [{ key, value }] }` and updates or,
  when `value` is `null`, deletes the override (reverting to env/default).
- `/api/admin/documents` — `GET` lists every document across all IPs with
  search (`search`, scoped to selected `search-keys`), creator filter (`by`),
  pagination (`limit`/`offset`), and sorting (`sortBy`/`order`).
- `/api/admin/documents/[id]` — `PUT` updates a document (`name`,
  `updatedBy`, `createdBy`, and/or `key`); `DELETE` removes it.

- `/api/tags` — `GET` returns every distinct tag across all documents, with
  deduplication on case-insensitive name so each unique tag name appears once.

## Document Types

- `src/lib/document-type-values.ts` defines the eight allowed type constants
  (`text`, `csv`, `html`, `javascript`, `json`, `markdown`, `xml`, `yaml`) as
  an `as const` array, the union type, and the `isDocumentTypeValue` guard.
- `src/lib/document-types.ts` is the type registry: each type entry provides a
  `label`, file `extension`, `mimeType`, `validate` function, optional
  `convertTo` specs, a lazy-loaded `actions` component for type-specific
  toolbar buttons (Format / Convert), and an optional lazily-loaded `preview`
  component.
- `src/lib/document-type-utils.ts` holds pure formatting, converting, and
  validation functions (JSON/YAML parse/pretty-print, HTML/XML indent and XML
  DOM parse/serialize, CSV dialect validation via `csv-utils.ts`). Per-type
  language extensions are loaded lazily via dynamic `import()` inside the
  definition to keep the initial bundle lean.
- Preview components are per-type lazy-loaded chunks rendered by
  `PreviewPane.svelte`: `MarkdownPreview` (renders with `marked`),
  `HtmlPreview` (renders the document in a sandboxed iframe),
  `StructurePreview` (an editable tree for JSON/XML/YAML, see Editor), and
  `CsvPreview` (a DataGrid spreadsheet).
- Document create accepts an optional `documentType`; the PUT route validates
  the type. On save, the editor validates content against the type and rejects
  invalid content before sending the request.

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
  public `key`, `name`, `content`, `document_type` (text default),
  `tags` (JSON array default `[]`), `created_by`/`updated_by` IPs,
  `created_at`/`updated_at`), the `idx_documents_updated_at` index,
  the `document_versions` table (one content snapshot per save,
  `idx_document_versions_document_id_created_at` index), and the `app_config`
  key/value table that stores runtime property overrides.
- Content versions: creating a document records its initial state as the
  first snapshot, and a save that changes `content` or `document_type` inserts
  another row into `document_versions` (content, type, `created_by`, time);
  each insert then prunes every row beyond the newest `max_document_versions`
  (`MAX_DOCUMENT_VERSIONS`, default 20) for that document. The latest version
  therefore always mirrors the last saved body. `deleteDocument` removes a
  document's versions explicitly, and a key change (admin rename of the id)
  migrates the rows to the new key. The production `db.ts` bootstrap creates
  the table if it does not exist, matching the tags-column migration.
- Tags are normalized on write: trimmed, deduplicated case-insensitively,
  sorted by name, with colors drawn from the fixed palette and same-family
  colors avoided. The distinct tag list for `/api/tags` comes from a short-TTL
  in-memory cache invalidated on document create/update/delete.
- Document keys are `document_key_length` characters (default 6) from `0-9a-z`
  generated with rejection sampling over `crypto` random bytes; insert retries
  on unique-key collisions up to `MAX_KEY_ATTEMPTS` times. A document created
  without a name is named after its generated key.

## Admin

- `src/lib/server/admin-auth.ts` hashes admin passwords with scrypt
  (`ADMIN_PASSWORD_HASH`, or `ADMIN_PASSWORD` for dev), issues HMAC-signed
  session tokens (`SESSION_SECRET`), verifies the session cookie, and rate
  limits failed logins in memory per IP.
- `src/hooks.server.ts` guards every `/api/admin/*` route except `login` and
  `session`, returning 401 for requests without a valid session cookie.
- `src/lib/server/settings.ts` defines the runtime-adjustable properties and
  resolves them with precedence database override > environment > default,
  cached in memory for a short TTL and invalidated on write.
- `src/lib/admin.ts` is the fetch-based admin API client; the `/admin` route
  (`src/routes/admin/+page.svelte`, backed by `AdminPage.svelte`) shows the
  login panel when unauthenticated and the Properties and Documents tabs after
  sign-in. The old gear-icon dialog (`AdminDialog.svelte`) has been removed.
  The login form has a "Remember me" checkbox that persists the username in
  `localStorage` under `share-text-admin-remembered-login` (pre-filling it on
  the next visit) and issues a 30-day session cookie instead of the default
  24-hour one; the password is never stored client-side.
- In the Documents tab, the ID, Name, Created by, and Updated by cells are
  copyable editable text via `PUT /api/admin/documents/[id]`, which accepts
  `name`, `updatedBy`, `createdBy`, and `key`. Attribution fields are bounded
  by `MAX_ATTRIBUTION_LENGTH` (defaulting `updated_by` to the requester IP
  otherwise); changing `key` renames the document id and must match the
  configured `document_key_length` charset, returning 409 on collision.
- Admin mutations are logged (`admin_login`, `admin_login_failed`,
  `admin_logout`, `admin_setting_update`, `admin_setting_reset`,
  `admin_document_rename`, `admin_document_update_updated_by`,
  `admin_document_update_created_by`, `admin_document_update_key`,
  `admin_document_delete`).

## Limits

- `MAX_DOCUMENTS_PER_IP` (default 10) caps how many documents a single client IP
  can create (`created_by`); exceeding it returns 403. It, the content limit,
  and `DOCUMENT_KEY_LENGTH` (default 6, the generated id character count) are
  resolved at request time from `app_config` overrides or env.
- Content is capped at a hard 1 MiB byte limit plus `MAX_CONTENT_LENGTH` (default
  1048576) characters; both are enforced on create and update.
- Each document keeps at most `MAX_DOCUMENT_VERSIONS` (default 20) content
  versions; the oldest snapshots are pruned on every versioned save.
- Default names are the document's own generated key. Names are
  trimmed, required, and limited to 200 characters.

## Client State

- `src/lib/documents.ts` is the fetch-based API client.
- `document-drafts.ts` wraps `localStorage` for per-document drafts, guarded
  against SSR and storage/quota errors.
- `share-text-context.ts` exposes a Svelte context through which the shell
  shares the document list, refresh/create/delete operations, a
  selected-document refresh token, editor dirty-state guard registration, and
  editor-focus registration (the shell focuses the active editor on navigation).
- `(browser)/+layout.svelte` is the shell: it owns the document list (loaded in
  pages), runs `beforeNavigate` through the dirty guard, and hosts the discard
  and delete confirm dialogs. Deleting the currently selected document navigates
  to `/`.
- `(browser)/new/+page.svelte` drives the new-document draft page: it keeps
  name/content/type in `$state`, persists a `share-text:draft:new` draft, and
  creates the document through the API client on save.
- `use-preview-mode.svelte.ts` holds the editor/split/preview mode tri-state,
  reading and writing it to the URL query string (`?preview=true`,
  `?editor=false`); `editor-preview-split.ts` mirrors and persists the editor
  percentage to `localStorage`; `use-preview-content.svelte.ts` mirrors content
  into a debounced value (immediate on document switch) so heavy previews do not
  re-render on every keystroke.

## Editor

- The editor is CodeMirror 6, lazy-loaded via `LazyCodeEditor` (dynamic
  `import()`) so the initial route bundle stays small. A transaction filter caps
  document length at `maxContentLength`.
- `DocumentEditorPane.svelte` orchestrates the toolbar, CodeMirror editor, and
  preview pane. The `CodeEditor.svelte` wrapper manages the CodeMirror instance
  lifecycle (create, reconfigure on type change, destroy on unmount) and wires
  per-type language extensions from the type registry.
- Preview: `PreviewPane.svelte` lazy-loads the type's preview component;
  `usePreviewMode` cycles editor/split/preview modes through the URL,
  `usePreviewContent` debounces the source, and a `Splitter` in percentage mode
  divides the panes with the ratio persisted via `editor-preview-split.ts`.
- CSV previews use a spreadsheet grid: `DataGrid.svelte` renders
  `use-grid-model.svelte.ts` (per-cell committed flags, self-echo
  reconciliation, bounded undo/redo history) with `use-grid-selection`,
  `use-grid-clipboard`, and `use-grid-autoscroll` composables; `CsvPreview`
  wires parsing/serialization via `csv-utils.ts` (papaparse).

### DataGrid Column Resize

`DataGrid` supports per-column width control. Its immediate consumer is the
Properties preview, which passes `initialColumnWidths={['35%', '65%']}`.

- **Width model.** `columnWidths` is `$state`, one entry per data column,
  `null` meaning auto-width (the `min-w-32` fallback). As soon as it becomes
  non-empty, `managedWidths` switches the table to `table-layout: fixed`, emits
  a sized `<colgroup>`, and pins the table `style.width` to `totalWidth`
  (36px row-number column plus the data columns), so each sized column keeps
  exactly its pixel width. Without explicit widths the table stays `w-full`
  with auto layout.
- **`initialColumnWidths` resolution.** Each entry is `'30%'` (resolved against
  the container `clientWidth`), `'200'` (px/bare number, default 128), or
  omitted. Non-last columns are clamped to a 60px minimum; the last column
  absorbs the exact remainder, so on first layout the table's border box fills
  the container. Because the table's outer left edge is a 1px `border-l`,
  `resolveInitialWidths` computes `available` as `clientWidth − 36 − 1`
  (`TABLE_LEFT_BORDER`). Percentage widths are re-resolved through a
  `ResizeObserver` on container resize.
- **Making an auto-width grid measured.** When a grid built with auto-width
  columns first starts a resize, `startColumnResize` snapshots every column's
  rendered `offsetWidth` and captures existing `columnWidths`, handed to the
  model until the grid structure changes.
- **Splitters.** Every column-selector header cell (first `thead` row) hosts an
  absolutely-positioned `w-1.5` handle (mid-column handles offset `right:-3px`
  to straddle the boundary, the trailing one at `right:0`). Each data column is
  therefore bounded by two splitters:
  - A **mid-column** splitter re-partitions its two adjacent columns within a
    fixed combined total (both kept ≥ 60px and above their partner's minimum),
    so all outer and non-adjacent columns stay put.
  - The **trailing** splitter moves the table's right edge. Expanding right
    grows the table beyond the container and introduces a horizontal scrollbar;
    shrinking left clamps at the width that exactly fills the container (the
    live `gridContainer.clientWidth` minus the row-number column, 1px border,
    and other columns), so the table never leaves empty space while the grid
    needs no scrolling. The drag (mousemove/mouseup) is handled on
    `svelte:window`, so interaction continues outside the container.
- **Structural changes.** An effect keeps `columnWidths` aligned with the
  current column count in managed mode (columns are inserted/removed via the
  toolbar), reusing the stored width or the rendered cell width (default 128)
  for new columns.
- Structured previews use `StructurePreview.svelte` (parse/serialize JSON, YAML,
  or XML) rendering an editable `StructureTree`/`StructureNode`; edits are
  patched immutably via `structure-value.ts` and serialized back to content.

### Version History

A document always has one version for its creation state, and a content/type
save appends another. Once a document has two or more versions it shows a
History (clock) button in the editor toolbar. Clicking it opens `HistoryDialog`:

- The dialog loads the version list (`GET /api/documents/[id]/versions`,
  newest first), auto-selects the newest version, and fetches the selected
  version's content on demand (`GET .../versions/[versionId]`). The content is
  shown read-only in a monospace view alongside the version's type, author,
  size, and timestamp. Two tooltip icon buttons sit in the pane header:
  Compare with current splits the content area into the selected version (left)
  and the current editor content (right); each split pane shows its own
  document type tag between its label and the content, since a version may
  have a different type than the current state. Restore copies the selected
  version's content and type back into the editor. When the selected version
  already matches the current editor content and type, both buttons are hidden
  since there is nothing to compare or restore.
- Restore copies the selected version's content and type back into the editor
  as unsaved changes (the user reviews and saves, which appends a new version);
  when the editor already has unsaved changes the restore is confirmed first.
- The editor page tracks the version count and refreshes it after each save so
  the History button appears as soon as a document has multiple versions.

## Concurrency

Writes are last-write-wins with no conflict detection or merge.

## Scripts

- `scripts/apply-schema.mjs` applies `sql/schema.sql` to the dev SQLite database
  or, under `PROFILE=prod`, to the PostgreSQL database.
- `scripts/recreate-schema.mjs` drops and recreates the schema. In `prod` mode
  it requires `PROFILE=prod` and confirms with a prompt; in `dev` it is
  idempotent (runs apply-schema, which is already idempotent).
- `scripts/hash-password.mjs` generates a scrypt password hash from a plaintext
  password via `node scripts/hash-password.mjs <password>`, for use as
  `ADMIN_PASSWORD_HASH`.
- `scripts/db-config.mjs` centralizes env-file parsing, profile resolution, and
  the SQLite SQL rewrite for scripts.
- `scripts/sync-vercel-env.mjs` merges `.env` and `.env.vercel`, upserts the set
  to Vercel production env vars, and removes stale ones.
- `scripts/deploy.sh` deploys to Vercel, waits for `READY`, and syncs the
  project's production domain to `APP_BASE_URL`.
