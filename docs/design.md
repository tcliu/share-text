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
  - The pane lists the documents created by the current client IP, most recently
    edited first. New documents are added to the list automatically. Documents
    created by other IPs stay reachable by their `/{doc-id}` URL.
  - A search box below the header (with a clear button) filters the list in
    place with a case-insensitive name substring; with an empty query every
    loaded document is shown.
  - A scrollable list of documents, each row a link to `/{doc-id}`. The row
    matching the current URL is highlighted. Rows show the document name, a
    non-text type chip, tag chips, and a **Delete** icon button (with tooltip).
  - Rows use a small font (`text-[13px]`).
  - Single-click navigates to the document.
  - The list loads more documents via infinite scroll when scrolling near the
    bottom.
  - When collapsed, the pane shrinks to a thin rail with a **Show document
    list** icon button that restores it.
- **Right pane: editor**
  - When nothing is selected (`/`), an empty-state message prompts the user to
    select or create a document.
  - When a document is selected (`/{doc-id}`), it shows:
    - a header row with the editable document name, a document type selector
      dropdown, and visible tag chips on the left, and a toolbar on the right
      with icon buttons (all with tooltips): type-specific **Format**/convert
      actions, **Preview** toggle (markdown), **Copy**, **Clone**, **Upload**,
      **Export**, **Reset**, **Tags**, and **Save**,
    - a CodeMirror plain-text editor that fills the rest of the pane (optionally
      split with a markdown preview pane),
    - a footer with the last-updated timestamp, updating-by IP, refreshing
      indicator, and character count (with limit).

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
- Drafts of deleted documents are removed.

## Renaming

- Renaming is available in both panes.
- A pencil (edit) icon sits next to the displayed name in the editor header and
  in each left-pane row; double-clicking the name also starts a rename. Either
  way the name becomes a text box, pre-filled and auto-focused.
- In the left pane, a single click still navigates; the navigation is deferred
  briefly so a double click is not treated as navigation.
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

- Documents with a **Markdown** type show a **Preview** toggle button in the
  toolbar. When activated, the editor splits horizontally into two panes: the
  CodeMirror source on the left and a rendered markdown preview on the right.
- The split ratio is adjustable via a draggable handle. Toggling preview off
  restores the full-width editor.

## Tags

- Tags are free-text labels associated with a document, displayed as colored
  chips next to the document name in both the left-pane rows and the editor
  header.
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

## Split Pane Resize

- The boundary between the document list and the editor is a draggable
  splitter. The left-pane width is persisted to `localStorage` and restored on
  reload; the default is 288 px, with a minimum of 160 px and a maximum of
  480 px.
- The list pane adjusts its min-width dynamically to match the measured header
  row content, clipped to the persisted max width, so the header controls
  always fit.

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

- The left pane lists the documents created by the current client IP, most
  recently edited first; documents created by other IPs are reached by URL.
- **Refresh** re-fetches the current IP's document set and the selected document
  so the search box and editor reflect changes made by other users. Documents
  removed by others disappear from the list automatically.

## Admin Dialog

- A gear icon in the left-pane header opens the **Admin** dialog.
- Unauthenticated visitors see a sign-in form. If no admin password source is
  configured, the dialog reports that admin is disabled instead.
- Successful sign-in sets an HTTP-only, `SameSite=strict` signed session cookie
  (24h TTL). Failed sign-ins are rate-limited per IP (5 per 15 minutes). All
  `/api/admin/*` routes except `login` and `session` require a valid session.
- The dialog has two tabs:
  - **Properties** — application properties (`max_documents_per_ip`,
    `max_content_length`). Each row shows its effective value and source
    (`Saved`/`Environment`/`Default`), an inline editor, and a revert button
    that deletes the database override. **Apply** persists changes, **Reload**
    re-fetches, **Reset** restores the draft to the current values.
  - **Documents** — every document across all IPs with search, sortable columns,
    pagination, row-selection with bulk delete, inline rename, and single-row
    delete (behind a confirm dialog).
- Editing a property or deleting/renaming a document triggers a refresh of the
  normal left-pane list; deleting the currently open document navigates to `/`.

### Runtime properties

- `.env*` values are boot-time defaults; the `app_config` table holds runtime
  overrides. Resolution precedence is database > environment > default.
- Overrides are cached in memory for a short TTL and invalidated on write, so
  document create/save paths do not hit the database on every request while
  admin edits take effect immediately.
