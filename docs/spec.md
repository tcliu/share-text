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
  - `db-sqlite.ts` uses Node's built-in `node:sqlite` (`DatabaseSync`) and
    rewrites `$n` → `?`, `bigserial` → `integer`, and `current_timestamp` → a
    UTC ISO `strftime` expression. The dev database file is auto-created and the
    schema applied on first start.
  - `db-neon.ts` uses the `@neondatabase/serverless` WebSocket `Pool`
    (node-postgres compatible) configured from `DATABASE_URL`, which avoids the
    cold TCP/SSL handshake of a plain `pg` pool in serverless runtimes.
- `sql/schema.sql` (idempotent) defines the `documents` table (`id` sequence,
  public `key`, `name`, `content`, `document_type` (text default),
  `tags` (JSON array default `[]`), `created_by`/`updated_by` IPs,
  `created_at`/`updated_at`), the `idx_documents_updated_at` index,
  the `document_versions` table (one content snapshot per save, keyed by the
  numeric `documents.id`, with the
  `idx_document_versions_document_id_created_at` index), and the `app_config`
  key/value table that stores runtime property overrides.
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
- `src/lib/admin.ts` is the fetch-based admin API client. The admin console
  (`src/routes/admin/`) has a `+layout.svelte` that hosts the tab chrome via the
  generic `Tabs` component (`src/lib/components/Tabs.svelte`), with the two
  tabs as real routes (`/admin/properties`, `/admin/documents`) backed by empty
  `+page.svelte` shells.
  A `+layout.server.ts` guards every `/admin/*` route server-side, redirecting
  unauthenticated sessions to `/login` before the client shell renders; the layout
  then redirects there on the client only when the session is genuinely gone
  (unauthenticated, session timeout, or sign-out) and shows a retryable error
  state for transient session-check failures. The auth state machine lives in the
  `useAdminAuth` composable (`src/lib/use-admin-auth.svelte.ts`); the layout
  defines the two `Tab` entries (label, path, toolbar snippet, content snippet)
  that render the shared `AdminPropertiesView`/`AdminDocumentsView`, and keeps
  the settings/documents state alive across tab switches. The old gear-icon
  dialog (`AdminDialog.svelte`) has been removed.
  The login form has a "Remember me" checkbox that persists the username in
  `localStorage` under `share-text-admin-remembered-login` (pre-filling it on
  the next visit) and issues a 30-day session cookie instead of the default
  24-hour one; the password is never stored client-side.
- The console routes its tabs as real routes so each keeps a stable, shareable
  URL: `/admin` redirects (`+page.server.ts`) to `/admin/properties` when the
  session is authenticated and to `/login` when it is not. `Tabs` renders the
  tab bar (marking the active path with `aria-current="page"`, wrapped in a
  `nav` landmark labelled via the `ariaLabel` prop), the active tab's toolbar,
  and the active tab's content; the layout stays mounted across tab navigation
  so the settings draft and documents data survive tab switches, and the
  documents list lazy-loads via a layout `$effect` on the documents path. The
  `beforeNavigate` discard guard lets navigations within `/admin` through
  without prompting, since the shared state survives tab switches, and the
  admin layout renders no top header row until the session is `authenticated`.
  The pre-login page lives at `/login` (`+page.server.ts` redirects
  authenticated sessions to `/admin/properties` and returns the `configured`
  flag otherwise; `+page.svelte` renders the shared `LoginPanel`), and a
  successful sign-in there navigates to `/admin/properties`.
- In the Documents tab, the ID, Name, Created by, and Updated by cells are
  copyable editable text via `PUT /api/admin/documents/[id]`, which accepts
  `name`, `updatedBy`, `createdBy`, and `key`. Attribution fields are bounded
  by `MAX_ATTRIBUTION_LENGTH` (defaulting `updated_by` to the requester IP
  otherwise); changing `key` renames the document id and must match the
  configured `document_key_length` charset, returning 409 on collision.
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
  `admin_document_update_key`, `admin_document_delete`).

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
  `beforeNavigate` through the dirty guard, and hosts the discard and delete
  confirm dialogs. The first page of summaries is preloaded on the server via
  `(browser)/+layout.server.ts` (the same `fetchDocumentSummaries`/
  `getClientAddress` path as the API, `DEFAULT_DOCUMENTS_PAGE_SIZE`) and seeded
  once into `useDocuments` via `initialDocuments`/`initialHasMore`, so the list
  renders without a client fetch or a "Loading documents..." flash; the layout
  only falls back to a client `refreshList()` when no seed was provided (e.g.
  component tests). Deleting the currently selected document navigates to `/`.
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
toggle pair and the Copy, Clone, Tags, Copy link, Reset, and Save toolbar
buttons (Clone only when available; Copy link and Tags only for saved
documents). On desktop the toolbar shows the TypeActions plus the
Copy, Clone, History, Upload, Export, Format, Tags, Copy link, Reset, and Save
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
where there is nothing to collapse). `DocumentList` sizes itself full-width on
mobile via `w-full` (the inline `width` style is only set on desktop). The left
pane header shows a Login button after the Refresh button that navigates to
`/login`, so admin sign-in is reachable from the document browser.

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
  Compare with current splits the content area into the selected version (left)
  and the current editor content (right); each split pane shows its own
  document type tag between its label and the content, since a version may
  have a different type than the current state. Restore copies the selected
  version's content and type back into the editor. The two buttons are disabled
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
