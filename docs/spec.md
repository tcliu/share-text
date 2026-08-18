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
  `^[0-9a-z]+$` key character set, resolves the viewer, and throws a 404 when
  the id is invalid or the document does not exist or is not viewable; the page
  component renders server data (with `editable`/`owned`/`canManageAccess`
  flags), then re-fetches the document client-side on refresh.
- `/api/documents` — `GET` returns paginated summaries (`limit`/`offset`,
  `hasMore`) of every document the viewer can see (public, owned, or shared),
  with an optional server-side search (`search`, scoped to `search-keys`);
  each summary carries `owned`/`editable`/`isPublic` flags (used by the UI to
  gate the editor delete button and the private lock badge). `POST` creates a
  document (201) attributed to the resolved viewer (`owner_user_id` when
  signed in) and enforces the per-IP create limit.
- `/api/documents/[id]` — `GET` returns one document; `PUT` updates `name`,
  `content`, `documentType`, `tags`, or any combination thereof and returns
  the updated document; `DELETE` removes it (204). All three run through
  `resolveDocumentAccess` (`canView`/`canEdit`/`canDelete`): anonymous callers
  without access get 404, signed-in users without access 403. A `PUT` that
  changes `content` or `documentType` records a content-version snapshot.
- `/api/documents/[id]/versions` — `GET` returns the saved content versions
  for a document, newest first (metadata only: id, type, author, size,
  timestamp). `/api/documents/[id]/versions/[versionId]` — `GET` returns one
  version including its content.
- `/api/documents/[id]/access` — `GET` returns the document's
  `{ isPublic, sharedWith }` state; `PUT` accepts `{ isPublic?, sharedWith? }`
  and persists it in one `db.transaction`. Both require `canManageAccess`
  (a signed-in owner or admin — anonymous viewers can never manage access),
  and `sharedWith` is capped at `MAX_SHAREES` (100) users resolved by username
  or email. The `PUT` is all-or-nothing: it resolves the whole share list
  first (active users only by default, all registered users including inactive
  for an admin viewer via `setDocumentAccess`'s `includeInactive` option), and
  if any entry resolves to no user — matched case-insensitively against
  usernames and emails — it returns 400 with `{ error, missing }` and writes
  nothing, so a partially-valid share list is never persisted.
- `/api/auth/login` — `POST` verifies credentials against a registered user
  (by username or email) or the configured admin (when the identifier matches
  `ADMIN_USERNAME`), sets the matching HTTP-only session cookie, claims
  same-IP anonymous documents on a successful user sign-in, and is
  rate-limited per IP via the `login_attempts` table. `/api/auth/register` —
  `POST` creates a user account (lowercase username, email, scrypt-hashed
  password), claims same-IP anonymous documents, and signs it in (201).
  `/api/auth/logout` clears both session cookies. `/api/auth/session` reports
  the signed-in `user` (dropping stale sessions for inactive users) and any
  `admin` identity.
- `/api/admin/login` — `POST` verifies admin credentials, sets an HTTP-only
  signed session cookie, and is rate-limited per IP. `/api/admin/logout`
  clears the cookie. `/api/admin/session` reports whether admin is configured
  and whether the caller is authenticated.
- `/api/admin/settings` — `GET` returns resolved application properties with
  their source; `PUT` accepts `{ settings: [{ key, value }] }` and updates or,
  when `value` is `null`, deletes the override (reverting to env/default).
- `/api/admin/documents` — `GET` lists every document across all IPs with
  search (`search`, scoped to selected `search-keys`), creator filter (`by`),
  pagination (`limit`/`offset`), and sorting (`sortBy`/`order`); `POST`
  dispatches on the body shape — a `{ records: [...] }` body bulk-imports
  documents where each record is
  `{ name, content, documentType?, tags?, isPublic?, key? }`. A provided `key`
  must be unique within the batch; when it already exists the record merges
  (upserts) into that document — updating name/content/type/tags/visibility
  and recording a version snapshot — otherwise the document is inserted with
  the given or an auto-generated key (capped at `MAX_IMPORT_RECORDS`, 500). A
  direct `{ name, content, documentType? }` body creates one document
  attributed to the requester IP.
- `/api/admin/documents/[id]` — `GET` returns the full `AdminDocument` (with
  `content`) for the edit dialog; `PUT` updates a document (`name`,
  `updatedBy`, `createdBy`, `key`, `isPublic`, `documentType`, and/or
  `content`); `DELETE` removes it.
- `/api/admin/users/[id]` — `PUT` updates a user (`username`, `email`,
  `password`, and/or `status`); `DELETE` removes it (leaving documents
  ownerless and removing share rows via cascade).
- `/api/admin/documents/export` — `GET` returns a JSON array of documents
  (every document, or only the comma-separated `ids` selection) shaped like
  import records (`{ key, name, content, documentType, tags, isPublic }`) so
  the result round-trips through the import endpoint with keys preserved.
- `/api/admin/users` — `GET` lists users with search, pagination, and sorting;
  `POST` dispatches on the body shape: a `{ records: [...] }` body
  (`{ username, email, password?, status?, passwordHash? }` per record)
  bulk-imports users, while a direct `{ username, email, password, status? }`
  body creates a single user. Both imports are all-or-nothing: all records are
  validated before any insert and the inserts run in one `db.transaction`, so
  any invalid or conflicting record aborts the whole import. Since `username`
  and `email` are both unique, batch-uniqueness for each is validated before
  hashing and inserting. A record supplies either `password` (hashed with the
  shared `hashPassword`) or `passwordHash` (a validated `scrypt$...` hash used
  verbatim, so exports re-import directly), never both.
- `/api/admin/users/export` — `GET` returns a JSON array of users (every
  user, or only the comma-separated `ids` selection) shaped like import
  records plus the password hash (`{ username, email, status, passwordHash }`);
  the scrypt hash is exported so the export re-imports directly with
  credentials preserved, while a plaintext password never leaves the server.

- `/api/tags` — `GET` returns every distinct tag across the documents the
  viewer can see, with deduplication on case-insensitive name so each unique
  tag name appears once.
- `/api/users/search` — `GET` searches users by username/email prefix (`q`),
  returning at most 10 matches; admin-only (requires an admin session) and
  includes inactive users, so the share dialog can suggest anyone a document
  can be shared with.
- `/api/users/recent-sharees` — `GET` requires a user session and returns the
  distinct active users the current user has previously shared with across
  their owned documents; the share dialog seeds its suggestion list from this
  so a normal user is never shown the full user directory.

## Document Types

- `src/lib/document-type-values.ts` defines the nine allowed type constants
  (`text`, `csv`, `html`, `javascript`, `json`, `markdown`, `properties`,
  `xml`, `yaml`) as an `as const` array, the union type, and the
  `isDocumentTypeValue` guard.
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
  `StructurePreview` (an editable tree for JSON/XML/YAML, see Editor),
  `CsvPreview` (a DataGrid spreadsheet), and `PropertiesPreview` (a DataGrid
  spreadsheet without a header row).
- Document create accepts an optional `documentType`; the PUT route validates
  the type. On save, the editor validates content against the type and rejects
  invalid content before sending the request.

## Data Layer

- `src/lib/server/documents.ts` holds all persistence logic with
  engine-agnostic SQL using `$n` placeholders and `current_timestamp`.
- `db.ts` resolves the `PROFILE` and returns the matching `Db` adapter (the
  small `query`/`close` interface in `db-types.ts`):
  - `db-sqlite.ts` uses the `better-sqlite3` package and
    rewrites `$n` → `?`, `bigserial` → `integer`, and `current_timestamp` → a
    UTC ISO `strftime` expression. The dev database file is auto-created and the
    schema applied on first start.
  - `db-neon.ts` uses the `@neondatabase/serverless` WebSocket `Pool`
    (node-postgres compatible) configured from `DATABASE_URL`, which avoids the
    cold TCP/SSL handshake of a plain `pg` pool in serverless runtimes.
- `sql/schema.sql` (idempotent) defines the `documents` table (`id` sequence,
  public `key`, `name`, `content`, `document_type` (text default),
  `tags` (JSON array default `[]`), `created_by`/`updated_by` attribution,
  `owner_user_id` FK to `users` (null for anonymous documents), `is_public`
  (default true), `created_at`/`updated_at`), the
  `idx_documents_updated_at` index, the `document_versions` table (one content
  snapshot per save, keyed by the numeric `documents.id`, with the
  `idx_document_versions_document_id_created_at` index), the account/auth
  tables — `users`, `document_shares` (document/user pairs with a cascade
  composite primary key), `user_config`, and `login_attempts` (persisted login
  rate limiting) — plus the `app_config` key/value table that stores runtime
  property overrides.
- Content versions: creating a document records its initial state as the
  first snapshot, and a save that changes `content` or `document_type` inserts
  another row into `document_versions` (content, type, `created_by`, time);
  each insert then prunes every row beyond the newest `max_document_versions`
  (`MAX_DOCUMENT_VERSIONS`, default 20) for that document. The latest version
  therefore always mirrors the last saved body. `deleteDocument` removes a
  document's versions explicitly (also handled by the `on delete cascade` FK
  on Postgres), and because versions reference the immutable numeric
  `documents.id`, an admin rename of the key never requires migrating version
  rows; the version queries resolve the app-facing key to that numeric id via
  a subquery. The production `db.ts` bootstrap creates
  the table if it does not exist, matching the tags-column migration.
- Tags are normalized on write: trimmed, deduplicated case-insensitively,
  sorted by name, with colors drawn from the fixed palette and same-family
  colors avoided. The distinct tag list for `/api/tags` comes from a short-TTL
  in-memory cache invalidated on document create/update/delete.
- Document keys are `document_key_length` characters (default 6) from `0-9a-z`
  generated with rejection sampling over `crypto` random bytes; insert retries
  on unique-key collisions up to `MAX_KEY_ATTEMPTS` times. A document created
  without a name is named after its generated key.

### Viewers And Access Control

- `src/lib/server/viewer.ts` resolves a `Viewer` (`anonymous` | `user` |
  `admin`) per request from the admin and user session cookies: an admin
  session wins, then the user session token's `sub` is looked up (inactive or
  missing users fall back to anonymous). Route handlers resolve the viewer
  once and pass it through, so the client `owned`/`editable` flags always come
  from the listing/load data.
- `resolveDocumentAccess` (`src/lib/server/documents.ts`) computes
  `canView`/`canEdit`/`canDelete`/`canManageAccess` for a document. Anonymous
  viewers can view public documents and own only documents with
  `owner_user_id is null` and a matching `created_by` IP; registered users can
  view and edit public, owned, or shared documents but can delete/manage only
  what they own; an admin viewer bypasses visibility entirely. Document
  summaries (`fetchDocumentSummaries`) and the distinct tag list
  (`listDistinctTags`) apply the same visibility condition, so the list,
  search, and tag suggestions never leak private documents.
- `setDocumentAccess` writes `is_public` and the `document_shares` rows for a
  document in one `db.transaction`, resolving sharee usernames/emails to user
  ids via `findUsersByUsernameOrEmail` (active users by default; an
  `includeInactive` option — passed by the access route for admin viewers —
  also resolves inactive users). `claimAnonymousDocuments` reparents
  same-IP anonymous documents to a user on registration and login.
- `listRecentSharees` (`src/lib/server/users.ts`) returns the distinct active
  users the current user has shared with across their owned documents, backing
  the share dialog's seeded suggestions; `searchUsers` and
  `findUsersByUsernameOrEmail` accept the same `includeInactive` flag.

## Admin

- `src/lib/server/admin-auth.ts` hashes admin passwords with scrypt
  (`ADMIN_PASSWORD_HASH`, or `ADMIN_PASSWORD` for dev), issues HMAC-signed
  session tokens (`SESSION_SECRET`), and verifies the session cookie. Login
  rate limits (shared with user auth via `rate-limit.ts`) persist in the
  `login_attempts` table, so they survive restarts and are shared across
  instances.
- `src/hooks.server.ts` guards every `/api/admin/*` route except `login` and
  `session`, returning 401 for requests without a valid session cookie.
- `src/lib/server/settings.ts` defines the runtime-adjustable properties and
  resolves them with precedence database override > environment > default,
  cached in memory for a short TTL and invalidated on write.
- `src/lib/admin.ts` is the fetch-based admin API client. The admin console
  (`src/routes/admin/`) has a `+layout.svelte` that hosts the tab chrome via the
  generic `Tabs` component (`src/lib/components/Tabs.svelte`), with the three
  tabs as real routes (`/admin/properties`, `/admin/documents`,
  `/admin/users`) backed by empty `+page.svelte` shells.
  A `+layout.server.ts` guards every `/admin/*` route server-side, redirecting
  unauthenticated sessions to `/login/admin` before the client shell renders;
  the layout then redirects there on the client only when the session is
  genuinely gone (unauthenticated, session timeout, or sign-out) and shows a
  retryable error state for transient session-check failures. The auth state
  machine lives in the `useAdminAuth` composable (`src/lib/use-admin-auth.svelte.ts`);
  the layout defines the three `Tab` entries (label, path, toolbar snippet,
  content snippet) that render the shared `AdminPropertiesView`/
  `AdminDocumentsView`/`AdminUsersView`, and keeps the settings/documents/users
  state alive across tab switches. The old gear-icon dialog
  (`AdminDialog.svelte`) has been removed.
  `AdminPropertiesView` splits the Properties tab into state-driven **Form** and
  **Properties** sub-tabs (button tabs via `Tabs`, `aria-pressed`) that both
  edit the one shared draft held by `useAdminSettings`. `useAdminSettings` also
  keeps a Properties-format text representation of the draft
  (`propertiesText`) bound by the code editor (`AdminPropertiesCodeView`); the
  two directions are reconciled with the shared self-echo guard so the editor is
  never rewritten by its own push: editor edits are parsed back into the draft
  (`pickKnownSettings` + merge, unknown settings reported in a live
  `propertiesProblems` banner and never pushed), while form edits, Apply,
  Reload, and Reset resync the editor text. Apply persists only the changed
  settings through `PUT /api/admin/settings`; Reset restores both views from
  the saved settings. The old batch dialog (`AdminSettingsBatchDialog.svelte`)
  has been removed.
  The login form has a "Remember me" checkbox that persists the username in
  `localStorage` under `share-text-admin-remembered-login` (pre-filling it on
  the next visit) and issues a 30-day session cookie instead of the default
  24-hour one; the password is never stored client-side.
- The console routes its tabs as real routes so each keeps a stable, shareable
  URL: `/admin` redirects (`+page.server.ts`) to `/admin/properties` when the
  session is authenticated and to `/login/admin` when it is not. `Tabs`
  renders the tab bar (marking the active path with `aria-current="page"`,
  wrapped in a `nav` landmark labelled via the `ariaLabel` prop), the active
  tab's toolbar, and the active tab's content; the layout stays mounted across
  tab navigation so the settings draft and documents/users data survive tab
  switches, and each list lazy-loads via a layout `$effect` on its path. The
  `beforeNavigate` discard guard lets navigations within `/admin` through
  without prompting, since the shared state survives tab switches, and the
  admin layout renders no top header row until the session is `authenticated`.
  The admin sign-in page lives at `/login/admin` (`+page.server.ts` redirects
  authenticated sessions to `/admin/properties` and returns the `configured`
  flag otherwise; `+page.svelte` renders the shared `LoginPanel`), and a
  successful sign-in there navigates to `/admin/properties`. The browser-level
  account login/register page lives at `/login` (it redirects an existing admin
  session to `/admin/properties` and a user session to `/`).
- In the Documents tab, the ID, Name, Created by, and Updated by cells are
  copyable editable text via `PUT /api/admin/documents/[id]`, which accepts
  `name`, `updatedBy`, `createdBy`, `key`, `isPublic`, `documentType`,
  `content`, and `sharedWith` (an array of usernames/emails). A
  `documentType` change validates against the closed type set and
  records a version snapshot like a content change (via `updateDocument`).
  Attribution fields are bounded
  by `MAX_ATTRIBUTION_LENGTH` (defaulting `updated_by` to the requester IP
  otherwise); changing `key` renames the document id and must match the
  configured `document_key_length` charset, returning 409 on collision.
  `content` is validated against `MAX_CONTENT_BYTES` and the configured
  `MAX_CONTENT_LENGTH` and flows through `updateDocument`, so a content change
  records a version snapshot like any other content save. A `sharedWith` value
  resolves sharees including inactive users and applies them via
  `setDocumentAccess` (all-or-nothing: unresolvable sharees reject the whole
  update with 400 listing the missing values, sharing the access route's
  `missingSharees` helper). `GET
  /api/admin/documents/[id]` returns the full `AdminDocument` (with `content`)
  plus `sharedWith` (the document's share list from `getDocumentAccess`) for the
  edit dialog, which loads it once when the dialog opens.
- The Documents toolbar also offers an **Add** button that opens the same dialog
  in add mode; saving a new document POSTs a single `{ name, content,
  documentType? }` body to `/api/admin/documents`, which dispatches on the body
  shape (a `records` array imports, otherwise it creates one document attributed
  to the requester IP with an auto-generated key and an initial version
  snapshot).
- The edit dialog lays the **Details** fields (key, name, created by, updated
  by — plus a document-type dropdown, with the key/attribution fields hidden in
  add mode) and the **Content** editor (a lazily loaded `CodeEditor` bound to
  the document body whose language mode follows the selected type) out as two
  responsive panes: side by side when the dialog is wide enough, with the
  Content pane flowing below Details when the dialog is too narrow for both
  (a `flex-wrap` with a per-pane `min-w` floor). `BaseDialog` holds the title
  fixed while the body wrapper (`flex-1 min-h-0 overflow-y-auto`) scrolls, and
  the dialog keeps its OK/Create and Reset button row outside the scroll
  container, so the title and action buttons stay visible while only the panes
  scroll vertically on overflow. The dialog panel itself carries
  `overflow-y-auto` only as a safety net: content is expected to control its
  own space usage, and the panel-level scrollbar engages only when a dialog
  breaks that pattern, so overflow stays reachable rather than clipped. OK/Apply and Reset follow the
  shared editable-form pattern with `content` included in the dirty check, and
  OK stays disabled until the content fetch settles so the body can never be
  saved as empty mid-load. In edit mode the Details pane also shows an editable
  **Shared with** input via the shared `ShareeCombobox` component (colored
  removable username chips with an add-by-username/email search — the same
  control the Share dialog uses, with a `search` provider per source: the
  admin-only directory search here, previously-shared users in the Share
  dialog), seeded from the document's sharees, and an **Anyone with the link
  can view** checkbox
  mirroring the document's `isPublic` visibility, both loaded alongside the
  content from the `GET` detail response; they participate in the dirty check
  and reset, and saving sends `isPublic`/`sharedWith` only when they actually
  changed.
- The Documents and Users toolbars each offer an **Import** button that opens
  `ImportDialog.svelte`: a JSON-type lazily loaded `CodeEditor` plus an Upload,
  OK, and Reset button panel. **Upload** opens a `.json` file picker and loads
  the file text into the editor; **Reset** clears the editor. **OK** parses the
  content client-side — a single object is imported as one record, an array as
  many — and rejects invalid JSON or non-object values with an error toast.
  The parsed records then go through `importAdminDocuments`/`importAdminUsers`
  to the import endpoints, and on success the list reloads and the dialog
  closes. Import errors surface as toasts with the failing record index.
- A matching **Export** button sits next to each toolbar's Import button. It
  fetches the export endpoints (passing the currently selected ids when any
  rows are selected, otherwise exporting all records) and saves the returned
  JSON array as `documents-export.json` / `users-export.json` via
  `downloadJson` (`$lib/download-json.ts`), toasting the exported count.
- Both admin data tables are deletion-toolbar-driven: there are no per-row
  delete buttons. A **Delete selected** toolbar button (enabled when
  `selectedCount > 0`) opens a `ConfirmDialog` and runs a bulk delete
  (`confirmBulkDelete`) that deletes each selected row, clears the selection,
  reloads the list, and (for documents) fires the per-id `onAdminDelete`
  callback. The Documents toolbar already had this; the Users toolbar gained
  it, with `useAdminUsers` mirroring the documents' `bulkDeleteOpen`/
  `bulkDeletePending`/`confirmBulkDelete` shape (the old per-row
  `deleteTarget`/`confirmDelete` state was removed from both hooks).
- Neither admin tab has a row action column. Their toolbar **Edit** buttons
  are context-sensitive via `handleToolbarEdit`: on the Users tab a single
  selection opens that user's `UserDialog` in edit mode, while multiple
  selections (or a single stale cross-page selection that no longer resolves)
  open the batch status dialog (`bulkStatusOpen`) — the button is disabled
  with no selection. On the Documents tab the button is enabled only when
  exactly one row is selected, resolving that document from the current page's
  list and opening the `EditDocumentDialog` in edit mode — there is no batch
  edit for multiple selections. Per-row editing was removed, so single-record
  edits always flow through selection + toolbar Edit.
- The Documents and Users tables render their copyable/editable cells as plain
  values on touch-only devices, where the `(hover: hover)`-gated icons would be
  permanently visible and noisy. `useSupportsHover` (`src/lib/use-supports-hover.svelte.ts`)
  exposes the `(hover: hover)` matchMedia result as a derived value, and each
  view conditionally renders either the interactive cell
  (`EditableText`/`Copyable`) or a `PlainCell` truncating span on touch;
  editing stays available through the toolbar **Edit** button. The plain-value
  rendering is done at the view level; the shared components' reveal controls
  are gated separately via `(hover: hover)`.
- Admin imports attribute documents to the requester IP (`created_by` /
  `updated_by`), leave them unowned (`owner_user_id null`), honor an optional
  `isPublic` (defaulting to `true`), normalize tags through the same
  `parseTags`/`serializeTags` path as normal saves, and record an initial
  content-version snapshot per document. User imports hash passwords with the
  shared `hashPassword` before the transaction.
- The Documents table (`DataTable.svelte`) sorts via the shared two-arrow
  header pattern: `handleSortClick(column, direction)` passes the explicit
  direction through `onSort`. Column sizing prefers the `width`/`minWidth`
  props (`widthClass`/`minWidthClass` override them when given): a number is
  pixels, a string ending in `%` is a percentage (rebased so percentage columns
  sum to 100% before the `width` is applied), and any other string must be a
  valid CSS length — malformed width/min-width values are ignored and reported
  to the console. The derived width/min-width are applied as inline `style` on
  the cells (never as utility classes built at runtime); those inline minimums
  keep core columns (Key, Name, attribution, timestamps) from collapsing below
  a readable width when the panel narrows; overflow is handled by the
  container's horizontal scroll and the table's `min-w` floor. A `fillHeight`
  prop makes the table fill the available flex height instead of the fixed
  `containerClass` cap: the root becomes a `min-h-0 flex-1` column and the
  scroll container drops its `max-h` for `min-h-0 overflow-auto` (the search
  box and pagination stay pinned via `shrink-0`).
- The Documents table opts into resizable columns via `DataTable`'s `resizable`
  prop, which adds a draggable (and Arrow-key) splitter to each data column
  header — the checkbox column stays fixed. On the first resize the component
  snapshots each column's rendered `offsetWidth` into `columnWidths` (pixels per
  data column), switches the table to `table-layout: fixed` with a sized
  `<colgroup>` (fixed 40px checkbox column plus the data columns), and pins the
  table `style.width` to the total. Mid-column splitters re-partition two
  adjacent columns within a fixed combined total (both kept above their column's
  numeric `minWidth`, default 60px); the trailing splitter moves the table's
  right edge, expanding right beyond the container (horizontal scroll) and
  absorbing a left drag in the previous column — the previous splitter moves
  right, the last column shrinks, and the table's minimum width stays the
  container width. The resize engine itself lives in the shared
  `createColumnResize` composable (`use-column-resize.svelte.ts`), which owns
  the drag state and width math and takes the column count, scroll container,
  header-cell measurement, per-column minimum, and fixed reserved width as
  callbacks. The
  drag is requestAnimationFrame-throttled and handled on `svelte:window`; an
  effect keeps `columnWidths` aligned when the `columns` prop changes. When a
  `storageKey` prop is set, resized widths are persisted to `localStorage`
  (JSON array via `$lib/column-width-storage.ts`) and restored on mount,
  overriding the derived/auto layout. Before
  the first resize the table keeps its normal `w-full`/`min-w` auto layout, so a
  non-resizable table is byte-for-byte unchanged.
- Admin mutations are logged (`admin_login`, `admin_login_failed`,
  `admin_login_rate_limited`, `admin_logout`, `admin_setting_update`,
  `admin_setting_reset`, `admin_document_rename`,
  `admin_document_update_updated_by`, `admin_document_update_created_by`,
  `admin_document_update_key`, `admin_document_update_content`,
  `admin_document_update_type`, `admin_document_delete`, `admin_document_create`,
  `admin_document_import`, `admin_user_import`, `admin_user_create`,
  `admin_user_update_username`, `admin_user_update_email`,
  `admin_user_update_password`, `admin_user_update_status`,
  `admin_user_delete`, `admin_document_export`, `admin_user_export`).

## Limits

- `MAX_DOCUMENTS_PER_IP` (default 10) caps how many documents a single client IP
  can create (`created_by`); exceeding it returns 403. It, the content limit,
  `DOCUMENT_KEY_LENGTH` (default 6, the generated id character count), and
  `MAX_DOCUMENT_VERSIONS` are all resolved at request time from `app_config`
  overrides or env.
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
- `(browser)/+layout.svelte` is the shell: it owns the document list, runs
  `beforeNavigate` through the dirty guard, hosts the discard and delete
  confirm dialogs, and drives `useUserAuth` (session check on mount,
  sign-out) plus the `ProfileDialog`. The first page of summaries is preloaded
  on the server via `(browser)/+layout.server.ts` (the same viewer-resolving
  `fetchDocumentSummaries`/`getClientAddress` path as the API,
  `DEFAULT_DOCUMENTS_PAGE_SIZE`) and seeded once into `useDocuments` via
  `initialDocuments`/`initialHasMore`, so the list renders without a client
  fetch or a "Loading documents..." flash; the layout only falls back to a
  client `refreshList()` when no seed was provided (e.g. component tests).
  Deleting the currently selected document navigates to `/`. The Delete button
  lives in the editor toolbar (shown when the document is owned) and routes
  through the shared `deleteDocument` handler, so deleting a dirty document
  first prompts to discard before the delete confirmation.
- `(browser)/new/+page.svelte` drives the new-document draft page: it keeps
  name/content/type in `$state`, persists a `share-text:draft:new` draft, and
  creates the document through the API client on save.
- `use-preview-mode.svelte.ts` holds the editor/split/preview mode tri-state,
  reading and writing it to the URL query string (`?preview=true`,
  `?editor=false`); `editor-preview-split.ts` mirrors and persists the editor
  percentage to `localStorage`; `use-preview-content.svelte.ts` mirrors content
  into a debounced value (immediate on document switch) so heavy previews do not
  re-render on every keystroke.
- `DocumentEditorPane` keeps the editor focused across pane toggles: the
  editor/preview toggles, the mobile drawer button, and the list collapse button
  set the shared `Button` `preventFocusSteal` flag (a `pointerdown`
  `preventDefault`, so the button never takes focus), and closing the preview
  calls the bound editor's `focus()` (forwarded through `LazyCodeEditor` to
  `CodeEditor`) to return focus to the editor at its current cursor position.
  The browser layout's `toggleLeftPane` restores that registered editor focus
  (via the share-text context `registerEditorFocus` callback) whenever the
  desktop pane is toggled, covering the cases (keyboard activation, the rail
  Show-list button) where the `preventFocusSteal` `pointerdown` guard does not
  apply.

### Positioned Overlays

Overlay option panels (dropdowns, tag suggestions) position via the shared
`positionPanel` action (`src/lib/position-panel.svelte.ts`). Attach it to the
panel with `use:positionPanel={() => ({ getTrigger, getOpen, align?, autoPlace? })}`
and keep the `fixed left-0 top-0 z-50 will-change-transform` positioning classes
on the panel. The action portals the panel to `document.body`, auto-places it
above/below the trigger (with an 8px viewport margin), and repositions on
resize and scroll; it restores the panel to its original DOM parent on
unmount. The owning component keeps its own open/close, keyboard, and
outside-click handling.

`KebabMenu` (`src/lib/components/KebabMenu.svelte`) follows this pattern for a
three-dot action menu: it takes `items` (`{ id, label, onClick, disabled?,
icon? }`) plus an optional `ariaLabel`/`align`/`autoPlace`, keeps its own open
state and arrow-key focus (`activeIndex` with a `firstEnabledIndex` guard),
and closes on item click, Escape, outside pointer-down, and scroll.

`LanguageMenu` (`src/lib/components/LanguageMenu.svelte`) follows the same
pattern for the language picker: a globe-icon trigger opens a
`positionPanel` menu of the supported locales (labeled in their own language)
with the active one marked by a `menuitemradio` role and a dot; selecting a
locale calls `setLocale`. It renders in the document-list header (so also in
the mobile drawer, which reuses the `documentList` snippet) and in the
collapsed left rail.

### UI Localization (i18n)

Both the browser app and the admin console are localized through
`$lib/i18n.svelte`; the admin console has its own `admin.*` key namespace and
uses `t()` throughout (tabs, toolbars, DataTable headers, dialogs, login
panel, admin hooks).

- `LOCALES` is the closed set `en`, `zh-CN` (Simplified Chinese), `zh-TW`
  (Traditional Chinese), each with a native label for the picker. The `en`
  dictionary is the source (`as const`); `zh-CN`/`zh-TW` are typed
  `Record<MessageKey, string>` so every key must be translated or the build
  fails. `t(key, params?)` reads the module-level `$state` locale and
  interpolates `{name}` placeholders, so template/`$derived` calls re-render on
  locale change.
- The locale is a pure client-side preference: `setLocale` persists it to
  `localStorage` (`share-text:locale`) and sets `document.documentElement.lang`;
  `initLocale()` applies a saved non-default locale and is called from the root
  `+layout.svelte` `$effect`. SSR always renders English, so the server HTML and
  the first client render match (a one-frame English flash occurs when a saved
  locale is applied after mount) and there is no hydration mismatch.
- `t()` is called in templates and `$derived`; never in a `$props()` default
  (prop defaults evaluate once and would not react to a locale change). Shared
  components with default labels (`CopyButton`, `Copyable`, `Chip`, `Splitter`,
  `MobileDrawer`, `LazyCodeEditor`, `FormatDialog`, `TagInput`, `Combobox`,
  `SelectDropdown`, `DataTable`) keep the prop optional and resolve the fallback
  via `$derived(prop ?? t('key'))` or an inline `??` at the call site. Toast
  text in event handlers and async code uses the current locale at call time.
- English count-based pluralization (e.g. "{n} document(s)") is expressed as
  singular/plural key pairs (`admin.documents.deleted`/`...Plural`); the caller
  picks the key on `count === 1`. Chinese has no plural forms, so both keys map
  to the same string there.
- Data-driven labels rendered from reactive arrays (admin DataTable column
  headers, `AdminPropertiesView` source labels) are built in `$derived.by` so
  they follow a locale switch.
- Messages produced by the server (API `error` fields, setting labels and
  descriptions) remain English; only client-side UI text is translated.
- Document type labels and format titles (e.g. "JSON", "Format JSON") are
  technical format names and stay untranslated.

### Responsive Layout

Below the `md` breakpoint (767px, driven by a `matchMedia`-backed `isMobile`
`$state` exposed through the share-text context) the split panes collapse into
full-screen pages with no splitter: the document list occupies the whole screen
when no editor is open (on `/`), and opening a document (route `/[id]` or
`/new`) hides the list and shows the editor full screen. The document list is
still reachable from an editor via a left slide-out `MobileDrawer`: the editor
header shows a hamburger button before the filename that opens it
(`openMobileDrawer` on the share-text context, set on the layout's
`mobileDrawerOpen` state), and the drawer renders the same shared `documentList`
snippet the layout uses on the list route. The drawer is a `fixed inset-0 z-50`
overlay whose dark backdrop closes on click, whose panel (`w-full max-w-sm`)
hosts the list, and which closes on the collapse button, on Escape, and on any
client-side navigation via `afterNavigate`. The panel is exposed as
`role="dialog"`/`aria-modal` with a `tabindex="-1"` ref: opening it moves focus
to the panel, Tab is trapped within it, and closing restores focus to the
element focused before it opened. Its Escape handling follows the shared dialog
keydown protocol (respects `event.defaultPrevented`, marks
`shareTextDialogHandled`, stops immediate propagation) so it never double-fires
with `BaseDialog`.

On mobile the `DocumentEditorPane` header stacks into three rows — document
name + right-aligned type selector, then the tag chips, then the action
buttons — and both the tag and action rows `flex-wrap` when horizontal space
runs out; the first row is itself a wrapping flex where the name keeps a usable
width (`flex-1` with `min-w-[min(12rem,60%)]`), so the type selector drops to
its own row when the screen is too narrow for both. On mobile the action row
opens with a `KebabMenu` (three-dot) holding the Upload, Export, History, and
Format actions in that order (History only when the document has 2+ versions;
the menu owns the `FormatDialog`), followed by the Editor view / Preview view
toggle pair and the Copy, Read aloud, Clone, Tags, Copy link, Reset, and Save
toolbar buttons (Clone only when available; Copy link and Tags only for saved
documents). On desktop the toolbar shows the TypeActions plus the
Copy, Read aloud, Clone, History, Upload, Export, Format, Tags, Copy link,
Reset, and Save
buttons (History between Clone and Upload, Format between Export and Tags,
Copy link directly after Tags, Reset directly before Save). On desktop the
header lays the name/tags group, the type
selector, and the (self-wrapping) button panel out in one wrapping flex
(content-driven wrapping): the name/tags group uses `flex-basis: min-content`
and the type selector is a separate right-anchored item, so when the pane
narrows enough that the button panel would crowd the type selector the panel
wraps to its own row (left-aligned, since the shared row is kept flush-right by
the name group filling the space) and the type selector stays right-aligned at
the end of the first row; the buttons can themselves span multiple rows. The
`DocumentList` header shows a single collapse button (double-chevron-left icon)
before the New button; it renders only when the layout passes
`onToggleCollapse`, and the layout's derived `handleListCollapse` wires it to
toggle the desktop pane (`leftPaneCollapsed`, whose `w-11` rail with Show-list,
New, Refresh, Login buttons expands back with a double-chevron-right icon) and
to close the mobile drawer (so the button is absent on the mobile list route
where there is nothing to collapse). Collapsing or re-expanding the desktop
pane restores the registered editor focus so the visitor keeps editing after
the list gives way.
`DocumentList` sizes itself full-width on mobile via `w-full` (the inline
`width` style is only set on desktop). The left
pane header shows a Login button after the Refresh button that navigates to
`/login`, where visitors sign in or create an account (the account form also
accepts admin credentials when the identifier matches `ADMIN_USERNAME`). A
signed-in registered user sees Profile and Sign out buttons instead (Profile
opens `ProfileDialog`); a signed-in admin session sees an Admin console button
that navigates to `/admin` plus Sign out. `/api/auth/session` reports the
signed-in `user` and, when an admin session is present, an `admin: { username }`
identity so the browser app can render the admin entry point;
`/api/auth/logout` clears both the user and admin session cookies.

## Editor

- The editor is CodeMirror 6, lazy-loaded via `LazyCodeEditor` (dynamic
  `import()`) so the initial route bundle stays small. A transaction filter caps
  document length at `maxContentLength` for user edits, composing the truncation
  sequentially so it stays valid against the edit's base doc; programmatic
  content syncs (`filter: false`) bypass the filter so loading a document that
  exceeds the limit never truncates it or marks it dirty.
- `DocumentEditorPane.svelte` orchestrates the toolbar, CodeMirror editor, and
  preview pane. The `CodeEditor.svelte` wrapper manages the CodeMirror instance
  lifecycle (create, reconfigure on type change, destroy on unmount) and wires
  per-type language extensions from the type registry.
- Read aloud proxies the external tts service through two same-origin
  endpoints: `GET /api/tts/capabilities` (reports `configured` from the
  runtime `tts_service_url` setting plus the service's supported languages,
  both empty when the feature is unconfigured) and `POST /api/tts/synthesize`
  (forwards `{ text, lang }` to the service's `/api/synthesize` with
  `engine: auto`, maps errors to 4xx/5xx, and streams the returned audio
  **bytes** back with the service's Content-Type). Both endpoints resolve the
  language list via `getSupportedTtsLanguages` (`$lib/server/tts.ts`: fetched
  from the service's `/api/capabilities` and cached 60s, falling back to a
  default set cached 10s when the service is unreachable), so the gate and the
  client report the same languages. `$lib/server/tts.ts` reads
  the setting via
  `getSettingStringValue('tts_service_url')` (DB override, else
  `TTS_SERVICE_URL` env, else empty) and gates every endpoint with
  `isTtsConfigured()`, returning 503 when it is empty — the feature is
  disabled   without it. Admin can set/clear the URL in the Properties tab in
  real time (the settings value cache is invalidated on write). The editor
  button (`DocumentEditorPane`) loads capabilities once
  on mount (cached in `$lib/tts-client.ts`), reads the current CodeMirror
  selection when non-empty (`CodeEditor` exposes `getSelectionText()`,
  forwarded through `LazyCodeEditor`) else the whole document, splits the text
  into language segments via `splitTtsSegments` (`$lib/tts-language.ts`):
  the text is scanned character by character into latin/CJK runs — a run
  touching kana is ja, pure Han is zh, else en — so unspaced text like
  `Hello你好世界` splits into `en` + `zh` while `こんにちは世界` stays one
  `ja` segment; digits inherit the surrounding script (a number after Han is
  read in zh, after English in en); adjacent same-language runs merge across
  single line breaks, short runs (English < 4 chars, CJK < 2) fold into the
  dominant surrounding language so stray words don't create spurious segments,
  blank lines split paragraphs into separate segments so a document with many
  paragraphs streams incrementally, newlines inside CJK segments are stripped so
  Chinese/Japanese read as one continuous sentence (English keeps its newlines
  as natural pauses), and any paragraph still over `MAX_SEGMENT_LENGTH` (500
  chars) is split on sentence boundaries so no single request is oversized;
  each segment
  synthesizes with its own language model, then plays
  the audio segments in sequence from the proxy in a hidden `<audio>` element
  (advancing on the element's `ended`/`error` events). Synthesis is streamed:
  `synthesizeTtsStreaming` in `$lib/tts-client.ts` is an async generator that
  launches up to `SYNTHESIS_CONCURRENCY` (4) requests at once and yields each
  segment's blob as soon as it completes, preserving input order, so playback
  of the first segment starts before the rest of the document is synthesized.
  The button shows a Preparing spinner while synthesis runs before any audio,
  then switches to a Stop toggle once the first segment plays; the Stop toggle
  is active during both phases and synthesis is cancellable — `stopReading`
  aborts in-flight synthesis via an `AbortController` (passed as the fetch
  signal in `$lib/tts-client.ts`) and pauses playback. Playback is a play/stop
  toggle reset by the element's
  `ended`/`error`/`pause` events and paused on unmount. Repeat reads of the
  same segment skip synthesis: the per-segment cache in `$lib/tts-client.ts`
  keeps a bounded in-memory map (LRU-style eviction at 100 entries) keyed by
  `text + lang` storing the returned `Blob`; object URLs created from the
  blobs are revoked on stop/unmount. Synthesis is stateless: the backend
  returns audio bytes in memory (`backend/app/engines.py` writes Piper to a
  `BytesIO`) and writes nothing to disk, so
  there is no `output_path`/`/api/audio` round trip and no scratch dir — this
  is what makes the service multi-instance/serverless-safe. The backend caches
  the engine at the process level
  (`backend/app/engines.py`): one `PiperEngine` per model dir reused across
  requests with voices kept in memory, so parallel segment synthesis loads each
  model once. Piper is the only engine; a language is synthesizable only when
  its model files (`.onnx`
  + `.onnx.json`) exist on disk (`piper_lang_available`), so
  a missing voice degrades gracefully with a 503 instead of an unhandled 500.
  Empty documents disable the button.
- Preview: `PreviewPane.svelte` lazy-loads the type's preview component;
  `usePreviewMode` holds the editor/split/preview tri-state and reads/writes it
  to the URL (`?preview=true`, `?editor=false`) via two toggle setters
  (`setEditor`/`setPreview`) that always land on split when turning a pane on,
  `usePreviewContent` debounces the source, and a `Splitter` in percentage mode
  divides the panes with the ratio persisted via `editor-preview-split.ts`.
  On desktop the split lays the editor left and preview right with a vertical
  `Splitter` (`editorWidthPct`); on mobile the same split stacks the editor on
  top and the preview underneath (the content container switches to `flex-col`,
  each pane `min-h-0`, `flex-basis`/`flex-1` from `editorWidthPct`) with a
  horizontal `Splitter`. The `Splitter` component takes an `orientation` prop
  (`vertical` default for left/right dividers, `horizontal` for top/bottom
  dividers) that selects the drag axis, resize cursor, negative-margin/thickness
  classes, and arrow keys. When the current type has no preview component, the
  toggles and preview params are ignored for layout (the editor fills the pane).
- CSV previews use a spreadsheet grid: `DataGrid.svelte` renders
  `use-grid-model.svelte.ts` (per-cell committed flags, self-echo
  reconciliation, bounded undo/redo history) with `use-grid-selection`,
  `use-grid-clipboard`, and `use-grid-autoscroll` composables; `CsvPreview`
  wires parsing/serialization via `csv-utils.ts` (papaparse).

### Grid Model

The grid model (`use-grid-model.svelte.ts`) tracks a per-cell `committed`
flag. Arrow navigation past the last row/column appends *pending* rows/columns
whose cells stay uncommitted until a value is typed (`setValue`/paste/major
structural operations mark cells committed), so pure navigation never
serializes trailing empty cells into the CSV. `matrix()` bounds itself to the
committed region, and `pruneTrailingPendingRows`/`pruneTrailingPendingColumns`
drop empty pending rows/columns on navigate-away, Escape, or mouse click. The
model keeps a self-echo reconciliation: an incoming `value` that differs from
the last committed matrix only by trailing all-empty rows (the `parseCsv`
round-trip drops them) is treated as a self-echo so committed-but-empty rows
(e.g. toolbar inserts) survive the preview content feedback; a genuine
external change with different data rows still rebuilds the grid.

### DataGrid

`DataGrid.svelte` renders the grid for the CSV and Properties previews. It
accepts `maxColumns` to lock the grid to a fixed column count (disabling
column insert/delete/append, nav growth, and trimming, and clamping pastes to
it), `columnLabels` to show custom header labels instead of column letters,
`hideHeaderToggle` when the grid type has no header row (e.g. Properties), and
`initialColumnWidths` (percentage strings, px numbers, or omitted) to switch
the table to `table-layout: fixed` with explicit widths (see **DataGrid Column
Resize** below).

The column label row (topmost header row) also sorts data rows using the same
two-arrow header pattern as the admin `DataTable`: `model.sortRows(columnIndex,
direction)` uses the natural `compareGridValues` (numeric cells numerically,
otherwise locale-aware) and skips the header row when headers are on — the
header stays pinned while only the rows below reorder. The reorder commits
through the normal commit path, so it is undoable and reflected in `onChange`.
The sort indicator is a snapshot of the sort column taken at sort time; editing
any cell in that column invalidates it and hides the sort status (`aria-sort`
cleared) so the user can resort. The grid's outer edges come from the table's
`border-t`/`border-l` only, so cells keep single-edge borders (`border-r`/
`border-b`); any column-width math must subtract `TABLE_LEFT_BORDER` (1px) to
keep the table's border box inside the scroll container. The selection outline
recolors those owning borders (`rangeHighlightStyle` in
`use-grid-selection.svelte.ts`): a grid line is cyan when exactly one of the two
cells it separates is selected, so the outline sits exactly on the shared
borders instead of being drawn inside the cells. The outline's top edge above
the first data row runs along the column-label row's `border-b` and the left
edge of column 0 along the row-number column's `border-r`; single cells are
highlighted the same way instead of via an inset ring.

The grid is split into two sibling tables inside a flex column: the header
table (top) and body table (below). Only the body wrapper
(`min-h-0 flex-1 overflow-auto`) scrolls, so the trailing resize splitter in
the header row stays reachable without scrolling; the header wrapper
(`flex-none overflow-hidden`) never scrolls vertically. Each table carries its
own `<colgroup>` and `style.width`, so the two tables share identical column
widths in managed mode. A scroll listener mirrors the body wrapper's
`scrollLeft` into the header wrapper (its hidden scrollbar is what moves the
sticky header row horizontally), and wheel events over the header forward
`deltaY`/`deltaX` to the body wrapper. Sticky positioning is per-table (the
row-number cells stick to the body wrapper, the header cells to the header
wrapper), so the pinned column stays aligned across both tables. When the body
wrapper shows a vertical scrollbar, its `offsetWidth − clientWidth` is added as
`padding-right` on the header wrapper so the header's right edge lines up with
the body's visible area; a small `ResizeObserver` on the body wrapper keeps that
padding in sync with scrollbar appearance.

Cell editing is spreadsheet-style: a single click only selects the cell;
double-clicking enters edit mode with the cursor after the last character, and
double-clicking again while editing selects all text (`handleCellDoubleClick`
in `use-grid-selection.svelte.ts`). While a cell is being edited, mouse
interaction inside it behaves like a normal text input (caret placement /
in-cell text selection); grid range-dragging only works from a non-editing
cell.

Cells are editable as multiline text. Each cell editor is a `<textarea>`
(`<input>` cannot hold `\n`) styled identically to a single-line input. While
editing, `Shift+Enter` inserts a newline (the default textarea behavior, left
unintercepted); a plain `Enter` commits and moves down as before. Non-edited
cells always render `rows=1` with `overflow-hidden` and `wrap="off"`, so a
multiline value displays its first line in the normal-height cell. While a body
cell is being edited and its value contains a newline — tracked via a
component-level `editingCell` `$state` set on focus and cleared on blur — its
editor becomes a
floating overlay so the rest of the grid keeps its layout: the `textarea` is
positioned absolutely (`top:0;left:-1px;right:-1px;width:auto`, no explicit
height) — the `left/right:-1px` make it span the cell's border box — and it
carries the cell's left/right/bottom border in the selection-outline color
(`RANGE_COLOR`, exported from `use-grid-selection.svelte`), so the expanded
lines stay wrapped in the same blue border as the cell while it is being edited
(the editing cell is always selected). The left border is needed because the
base row's left grid line is the neighboring cell's border, which is only one
row tall; without the overlay's own left border, the expanded area below the
base row would lose its blue wrap on that side. The top edge stays the
neighbor cell's border (colored by the selection outline), since the overlay
starts at the cell's top. The owning `td` keeps the same
`position:relative;z-index:20`, so the overlay paints on top of the rows below
instead of growing the row. The overlay grows
one line at a time in the same units as a single-line cell: its `rows`
attribute is `min(lineCount, 5)` where `lineCount` is the number of newline-
separated lines in the current value, so each line uses the single-line cell's
line height; once the value exceeds 5 lines the editor switches to
`overflow-y:auto` and stays capped at a 5-line block instead of growing
further. The moment the value loses its newline or the cell loses focus the
editor returns to the in-flow single-line height. Header-row editors keep
`rows=2` growth instead of the overlay because the header band is a fixed-
height band whose wrapper clips any absolutely positioned child. Pressing
`Enter` (or blurring) returns the cell to single-line height. CSV and
properties serialization already round-trips embedded newlines (papaparse
quotes fields), so multiline cells survive the preview content feedback.

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
  (`TABLE_LEFT_BORDER`). A `ResizeObserver` on the outer viewport (the
  `overflow-hidden` flex column, not the scrolling body wrapper) re-runs the
  width math on container resize (see below).
- **Proportional container resize.** On container resize the `ResizeObserver`
  scales every column proportionally — each column becomes `round(width ×
  available / total)`, clamped to 60px — rather than leaving non-last columns
  fixed and shrinking only the last. The last column then absorbs the exact
  remainder so the table still fills the container edge-to-edge. The target
  `available` is `max(60 × columnCount, clientWidth − 36 − 1)`, so a container
  too narrow to hold even the minimum-width columns keeps the table overflowing
  (horizontal scroll preserved) instead of squeezing it — the same `usableDataWidth`
  floor as the two-table reference. The observer watches the outer viewport
  rather than the body wrapper so that the wrapper's own scrollbar appearing or
  disappearing never triggers a re-fit: an intentionally overflowing table stays
  overflowing until the pane itself is resized.
- **Making an auto-width grid measured.** When a grid built with auto-width
  columns first starts a resize, `startColumnResize` snapshots every column's
  rendered `offsetWidth` and captures existing `columnWidths`, handed to the
  model until the grid structure changes.
- **Splitters.** Every column-selector header cell (first `thead` row) hosts an
  absolutely-positioned `w-1.5` handle (mid-column handles offset `right:-3px`
  to straddle the boundary, the trailing one at `right:0`). The resize engine is
  the shared `createColumnResize` composable (same one DataTable uses), which
  owns the drag state and width math and takes the column count, scroll
  container, header-cell measurement, per-column minimum, and fixed reserved
  width as callbacks. Each data column is
  therefore bounded by two splitters:
  - A **mid-column** splitter re-partitions its two adjacent columns within a
    fixed combined total (both kept ≥ 60px and above their partner's minimum),
    so all outer and non-adjacent columns stay put.
  - The **trailing** splitter moves the table's right edge. Expanding right
    grows the table beyond the container and introduces a horizontal scrollbar.
    Shrinking left while the table overflows shrinks the last column until the
    table reaches the container width; once it would shrink below the container
    (the fill width, i.e. the live `gridContainer.clientWidth` minus the
    row-number column, 1px border, and other columns), the shortfall is absorbed
    by the previous column — the previous splitter moves right, the last column
    keeps shrinking, and the table's minimum width stays the container width
    with the trailing splitter anchored at the container's right edge. While
    dragging right past the container, the body wrapper auto-scrolls fully right
    so the trailing splitter stays visible at the container's right edge (the
    header wrapper mirrors that scroll); the scroll is applied in a nested
    animation frame after the width flush, and again on mouseup so the splitter
    stays reachable for a follow-up drag. The drag
    (mousemove/mouseup) is handled on
    `svelte:window`, so interaction continues outside the container, and
    `mousemove` applies only the latest pointer X once per animation frame
    (requestAnimationFrame-throttled) so pointer bursts don't thrash layout.
- **Persistence.** A `storageKey` prop (set by the CSV and Properties previews)
  persists `columnWidths` to `localStorage` as a JSON array via
  `$lib/column-width-storage.ts` on every resize and restores it on mount,
  overriding `initialColumnWidths`/auto layout when the column count matches.
- **Structural changes.** An effect keeps `columnWidths` aligned with the
  current column count in managed mode (columns are inserted/removed via the
  toolbar). A newly inserted column gets a fixed default width (128px, matching
  the auto-width `min-w-32` floor) — never a live measurement, since mid-effect
  its cells render at 0px and would pin the column invisible. When a column is
  removed the survivors are rescaled to refill the container (same
  `rescaleToContainer` used by the proportional container-resize path), so
  deleting a column never leaves a gap at the table's right edge.
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
  Compare with current replaces the content view with a side-by-side diff: the
  selected version on the left and the current editor content on the right,
  aligned row by row with removed lines marked `-` in red and added lines marked
  `+` in green, each column headed by its own document type tag, since a version
  may have a different type than the current state. The diff is computed by the
  `diff` (jsdiff) package's `diffLines`, lazy-loaded when the dialog opens so it
  never enters the initial bundle (a spinner covers the brief load); the
  `removed`/`added` blocks a changed region emits are paired into aligned rows
  by   `buildSideBySideRows` (`src/lib/version-diff.ts`), padding the empty
  counterpart where line counts differ, and both non-empty inputs are
  normalized to end with a newline so a trailing-newline-only difference is
  not reported as a change. Restore copies the
  selected version's content and type back into the editor. The two buttons are
  disabled
  (and show no tooltip) whenever there is nothing to act on — no version
  selected yet, a version still loading, or the selected version already
  matching the current editor content and type; they stay in place while a
  version loads so the panel never resizes, and only the disabled state
  changes, so Restore can never act on a stale version.
- Restore copies the selected version's content and type back into the editor
  as unsaved changes (the user reviews and saves, which appends a new version);
  when the editor already has unsaved changes the restore is confirmed first.
- The editor page tracks the version count and refreshes it after each save so
  the History button appears as soon as a document has multiple versions.
- On mobile the dialog is full screen (`fullscreen` prop on `BaseDialog`,
  driven by the `isMobile` context passed from the editor pane) instead of a
  centered modal. The action panel stays visible and the content pane plus the
  loading spinner use a fixed `h-[60vh]` (the version list stays capped at
  `max-h-[70vh]`), so the dialog never resizes when switching between versions
  of different content lengths — long content scrolls inside the pane via
  `overflow-auto`. The dialog itself never needs a scrollbar even on short
  viewports: the `BaseDialog` children wrapper, the dialog root, the
  list/content row (`md:h-[60vh]`), and the content pane are all `min-h-0`
  flex items, so when the fixed `60vh` pane plus the dialog chrome would
  overflow `BaseDialog`'s `max-h-[90vh]`, flexbox shrinks the pane to fit
  automatically.

## Concurrency

Writes are last-write-wins with no conflict detection or merge.

## Dev Environment Tag

- `DEV_TAG` (default unset) is read by the root `+layout.server.ts` load from
  `process.env` like other env vars (loaded into `process.env` in dev from the
  local `.env`/`.env.local`/`.env.dev` files by `vite.config.ts` at startup, so
  it takes effect on the next dev-server start). When set, the root
  `+layout.svelte` renders a sticky rectangular block at the bottom left of the
  browser showing the tag value, marking which worktree's changes the current
  build belongs to. Production builds are unaffected when unset.

## Scripts

- `scripts/create-worktree.mjs <branch>` creates a feature worktree: it runs
  `git worktree add .worktrees/<branch> -b <branch>`, copies the gitignored
  local dev files from the default worktree (`.env.dev` and all files under
  `.data/`), and sets `DEV_TAG=<branch>` in the new worktree's `.env.dev`.
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
