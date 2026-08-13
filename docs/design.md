# Design

This document captures the user-facing behavior and interaction design for
`share-text`. It complements `../README.md`, which describes how to run and
deploy the system.

## Purpose

A public scratchpad: anyone who opens the app can read every saved document,
edit its content, save changes back to the shared store, or delete the document
for everyone. There is no authentication and no per-user ownership.

## Layout

The page is split into two vertical panes.

- **Left pane: document list**
  - Header with **Collapse document list** (collapses the pane), **New
    document**, and **Refresh** icon buttons (all with tooltips).
  - The pane lists all shared documents, most recently edited first. New
    documents are added to the list automatically.
  - A search box below the header (with a clear button) searches the whole
    document store server-side with a short debounce (400 ms), matching document
    name, tags, or id with a case-insensitive substring; with an empty query the
    full list is shown.
  - A scrollable list of documents, each row a link to `/{doc-id}`. The row
    matching the current URL is highlighted. Rows show the document name (with
    a copy-on-hover button), a non-text type chip, and — only on rows created by
    the current client IP — a **Delete** icon button (with tooltip). The delete
    guard is a UI convenience only: the underlying API remains open to any
    visitor, and the admin **Documents** tab can delete any document.
  - Rows use a small font.
  - Single-click navigates to the document.
  - The list loads more documents via infinite scroll when scrolling near the
    bottom, both for the full list and for active search results.
  - When collapsed, the pane shrinks to a thin rail with a **Show document
    list** icon button that restores it.
- **Right pane: editor**
  - When nothing is selected (`/`), an empty-state message prompts the user to
    select or create a document.
  - When a document is selected (`/{doc-id}`), it shows:
    - a header row with the editable document name, a document type selector
      dropdown, and visible tag chips on the left, and a toolbar on the right
      with icon buttons (all with tooltips): an **Editor view** toggle and a
      **Preview view** toggle, type-specific **Format**/convert actions,
      **History** (when the document has multiple versions), **Copy**,
      **Clone**, **Upload**, **Export**, **Tags**, **Copy link**, **Reset**, and
      **Save**,
    - a CodeMirror plain-text editor that fills the rest of the pane (optionally
      split with a preview pane),
    - a footer with the last-updated timestamp, updating-by IP, refreshing
      indicator, and character count (with limit).

### Responsive layout

On screens narrower than the `md` breakpoint (767px) the two panes stop being
side by side and become full-screen pages: the document list occupies the whole
screen on `/`, and opening a document (or `/new`) hides the list and shows the
editor full screen. From the editor, a hamburger button before the document
name opens a left slide-out drawer with the document list; the drawer closes on
its collapse button, on Escape, on tapping the dark backdrop, and after
navigating to a document. On mobile the editor header stacks into rows —
document name and type selector, then the tag chips, then the action buttons —
and the action row opens with a three-dot (kebab) menu holding **Upload**,
**Export**, **History**, and **Format**, followed by the **Editor view** /
**Preview view** toggles and the **Copy**, **Clone**, **Tags**, **Copy link**,
**Reset**, and **Save** buttons.

## Navigation

- Documents are addressed by path: `{base-url}/{doc-id}`. The `[id]` route is at
  the root, so there is no `/doc/` prefix.
- The URL is the single source of truth for the selected document. Back/forward
  and deep links work; a valid `/{doc-id}` renders the document, and invalid or
  missing ids return a real HTTP 404 from the server load.

## Editing And Saving

- Typing in the editor marks the document dirty.
- **Save** persists `{ content }` with a `PUT`, updates the list order (most
  recently edited first), shows a toast, and clears any stored draft. `Ctrl+S`
  (or `Cmd+S` on macOS) triggers the same save when the document is dirty.
- **Reset** clears the stored draft and restores the editor to the last saved
  snapshot (the server content, or an empty string when the document was never
  saved). It is disabled while the document is clean.
- **Copy** copies the editor content to the clipboard (disabled when empty).
- **Export** downloads the content as a `{name}.{extension}` file, where the
  extension is determined by the selected document type (disabled when empty).

### Draft persistence

- Unsaved editor content is persisted per document to `localStorage`
  (`share-text:draft:{doc-id}`) so a page reload does not lose edits.
- A draft is written after a short debounce (~400 ms) while the document is
  dirty, and flushed on page unload. It is removed on save, on reset, and when
  the user discards changes.
- When a document is opened, the stored draft (if any) is restored as the
  editor content; the dirty state reflects the difference from the server
  snapshot, so unsaved edits still appear as unsaved after a reload.
- A new, unsaved document drafted on `/new` uses the same mechanism under a
  reserved key (`share-text:draft:new`).
- Drafts of deleted documents are removed.

## New Document

- **New** in the left-pane header opens a dedicated `/new` page for drafting a
  brand-new document. It starts with the name **Untitled** and an empty editor;
  saving validates and creates the document, then navigates to it.
- The draft is restored on reload; **Reset** discards it and clears the draft.
- The toolbar disables **Clone** and hides **Tags** while drafting a new
  document. Leaving the page with unsaved edits goes through the same discard
  guard.

## Renaming

- Renaming is available in the editor header and in the admin **Documents**
  tab. It is not available from the left-pane rows.
- In the editor header, a pencil (edit) icon appears next to the name on hover;
  double-clicking the name also starts a rename. Either way the name becomes a
  text box, pre-filled and auto-focused.
- Enter or blur commits the new name immediately with a `PUT { name }`; Escape
  cancels. Empty or unchanged names cancel instead of saving.
- The header and the left-pane row update in place. Renaming never affects
  unsaved editor content.

## Document Types

- A dropdown next to the document name in the editor header selects one of
  eight types: **Text**, **CSV**, **HTML**, **JavaScript**, **JSON**,
  **Markdown**, **XML**, or **YAML**. The dropdown is filterable — typing
  narrows the list.
- Changing the type marks the document dirty; the new type is persisted on the
  next save. Each type validates its content before saving and rejects invalid
  content with a toast explaining the error.
- Structured types (JSON, HTML, XML, YAML) show type-specific **Format** /
  **Convert** actions in the editor toolbar:
  - **Format** reformats the content according to the type (e.g. JSON
    pretty-print, HTML/XML indent).
  - **Convert** offers conversion to a related type (JSON ↔ YAML).
- The selected type determines the export file extension (`{name}.{ext}`),
  enables per-type syntax highlighting, and influences the upload file filter.

### Preview

- Types with a preview component (**Markdown**, **HTML**, **JSON**, **XML**,
  **YAML**, **CSV**) show an **Editor view** toggle (pencil icon) and a
  **Preview view** toggle (eye icon) in the toolbar instead of a single cycle
  button. The panes can never both be off: whichever pane is the sole active one
  has its toggle disabled. Turning a pane on always lands in split view (editor
  and preview side by side on desktop, stacked on mobile); turning it back off
  returns to the remaining pane.
- The active mode is encoded in the URL query string (`?preview=true`,
  `?editor=false`), so reloading or sharing the link keeps the mode.
- **Markdown** renders with `marked` into a sandboxed iframe; **HTML** renders
  the document directly in a sandboxed iframe.
- Structured types (**JSON**, **XML**, **YAML**) preview as an editable
  structure tree: double-clicking (or using the inline edit icon on) a value
  opens an in-place input, and double-clicking a key renames it; `Enter`
  commits, `Escape` cancels, and values can be copied.
- **CSV** previews as an editable spreadsheet grid (see **CSV Grid** below).
- The **Properties** type previews as an editable two-column **Key**/**Value**
  grid (see **CSV Grid**), with no header row.

### CSV Grid

- A **CSV** document previews as a spreadsheet-style grid. Arrow navigation past
  the last row or column appends a new (empty) row/column that only appears in
  the serialized document once a value is typed into it, so pure navigation
  never writes trailing empty cells back to the CSV.
- The grid toolbar offers insert/delete row and column controls, a header-row
  toggle (the first row can act as a header), a trim action that drops empty
  trailing rows/columns, and **Undo**/**Redo** (`Ctrl+Z`, `Ctrl+Shift+Z` /
  `Ctrl+Y`).
- `Tab` and `Enter` move between cells, `Escape` cancels the current edit, and a
  multi-cell clipboard paste fills cells from the anchor. Edits feed back into
  the document content and participate in the normal dirty/save flow.
- Column widths are adjustable by dragging the dividers between column headers
  (or by focusing a divider and pressing the arrow keys). Dragging the divider
  after the last column grows the grid beyond the visible area (a horizontal
  scrollbar appears, and the grid scrolls along so the divider stays visible);
  shrinking it stops once the grid again fills the pane without scrolling.
  Resizing the pane keeps the chosen column proportions, scaling every column
  proportionally rather than squeezing only the last. Adjusted widths are saved
  to `localStorage` and restored the next time the grid is opened.

## Tags

- Tags are free-text labels associated with a document, displayed as colored
  chips next to the document name in the editor header.
- A **Tags** button in the editor toolbar opens the **Tags dialog**, where the
  user can add new tags (typing or selecting from existing tags across all
  documents), remove tags, or reorder them.
- Each tag gets a deterministic default color from a 16-color palette assigned
  by a hash of the tag name. The dialog shows the current color assignment and,
  when adding a tag whose name's default color shares a color family with an
  existing tag on the same document, picks the next visually distinct color
  instead. Tags are saved immediately on closing the dialog (they do not
  participate in the dirty/save flow).

## Clone

- **Clone** in the editor toolbar creates a copy of the current document with a
  new id. The clone is named `{original-name} (copy)` (or the generated key
  when the original has no name), inherits the content and type of the source,
  and the browser navigates to the new document automatically. The clone is
  owned by the current client IP.

## Copy link

- **Copy link** in the editor toolbar copies the document's shareable URL (the
  origin plus the document's route id, without any query or hash) to the
  clipboard and confirms with a toast. It only appears for saved documents,
  next to **Tags** in the toolbar.

## Split Pane Resize

- The boundary between the document list and the editor is a draggable
  splitter. The left-pane width is persisted to `localStorage` and restored on
  reload; the default is 288 px, with a minimum of 160 px and a maximum of
  480 px.
- The list pane adjusts its min-width dynamically to match the measured header
  row content, clipped to the persisted max width, so the header controls
  always fit.
- In split view, the boundary between the editor and the preview pane is also a
  draggable splitter. The editor-pane percentage is persisted to
  `localStorage` and restored on reload, for all document types; the default is
  50%, with a minimum of 10% and a maximum of 90%.

## Upload

- **Upload** in the editor toolbar loads a local text file into the editor.
  When the document is dirty, it asks for confirmation first, because
  uploading replaces the editor content. Files longer than the content limit
  are rejected.

## Dialogs

- Confirm dialogs are centered, capped at the viewport
  (`max-h-[90vh]` with `overflow-y-auto`), and mounted only while
  open.
- The confirm button uses the primary variant with an accent color that matches
  the intent: amber for discard prompts, rose for destructive deletes.

## Discard Guard

Unsaved edits are protected across every way of leaving the current document:

- Clicking another document link or using back/forward cancels the navigation
  and prompts to discard.
- **New document** while dirty prompts first.
- **Refresh** while dirty prompts first (refreshing would otherwise overwrite
  local edits with the saved snapshot).
- **Delete** of the currently selected document while dirty prompts to discard
  before the delete confirmation.

The guard is coordinated through a shared context: the editor pane registers its
dirty-state guard with the shell, and the shell runs every leave-path through it.

## Shared Editing Model

- The left pane lists all shared documents, most recently edited first.
- **Refresh** re-fetches the full document set and the selected document so the
  search box and editor reflect changes made by other users. Documents removed
  by others disappear from the list automatically.

## Admin

The admin console is a dedicated area under `/admin`, reached by direct
navigation. A server-side layout guard redirects unauthenticated visitors to
the `/login` page, which shows the sign-in form; if no admin password source is
configured, the login page reports that admin is disabled instead. A
**Remember me** checkbox persists the username to `localStorage` (pre-filling
it on the next visit) and issues a 30-day session cookie; the password is
never stored client-side. The page header offers **Go to Documents** and
**Sign out** once signed in. The two tabs live at the real routes
`/admin/properties` and `/admin/documents` (`/admin` redirects to the
Properties route), so each view has a stable, shareable URL and survives
refresh and back/forward; the generic `Tabs` component renders the tab bar and
the active tab's toolbar and content from a per-tab `Tab` entry (label, path,
toolbar snippet, content snippet) defined in the shared admin layout, which
keeps the settings draft and documents data alive across tab switches.

- Successful sign-in sets an HTTP-only, `SameSite=strict` signed session cookie
  (24h TTL, or 30 days with Remember me). Failed sign-ins are rate-limited per
  IP (5 per 15 minutes). All `/api/admin/*` routes except `login` and `session`
  require a valid session.
- The page has two tabs:
  - **Properties** — application properties (`max_documents_per_ip`,
    `max_content_length`, `document_key_length`). Each row shows its effective
    value and source (`Saved`/`Environment`/`Default`), an inline editor, and a
    revert button that deletes the database override. **Apply** persists
    changes, **Reload** re-fetches, **Reset** restores the draft to the current
    values.
  - **Documents** — every document across all IPs with search, sortable columns,
    pagination, row-selection with bulk delete, inline editing of the ID, name,
    created-by, and updated-by cells (copyable editable text), and single-row
    delete (behind a confirm dialog). Editing the ID renames the document key.
    Column widths are adjustable by dragging the dividers between column headers
    (the checkbox column stays fixed); before any adjustment the columns use
    their configured percentage widths, and the table scrolls horizontally once
    the columns no longer fit.

### Runtime properties

- `.env*` values are boot-time defaults; the `app_config` table holds runtime
  overrides. Resolution precedence is database > environment > default.
- Overrides are cached in memory for a short TTL and invalidated on write, so
  document create/save paths do not hit the database on every request while
  admin edits take effect immediately.
