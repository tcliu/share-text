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
  - A search box below the header filters the list in place with a
    case-insensitive name substring; with an empty query every loaded document
    is shown.
  - A scrollable list of documents, where each row is a link to
    `/{doc-id}`. The row matching the current URL is highlighted.
  - Rows use a small font (`text-[13px]`).
  - Each row has a **Delete** icon button (with tooltip) on the right.
  - Single-click navigates to the document.
  - When collapsed, the pane shrinks to a thin rail with a **Show document
    list** icon button that restores it.
- **Right pane: editor**
  - When nothing is selected (`/`), an empty-state message prompts the user to
    select or create a document.
  - When a document is selected (`/{doc-id}`), it shows:
    - a header row with the document name on the left and a button panel on the
      right containing five icon buttons with tooltips — **Copy**, **Upload**,
      **Download**, **Reset**, and **Save** (in that order),
    - a CodeMirror plain-text editor that fills the rest of the pane,
    - a footer with dirty state and character count.

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
- **Download** downloads the content as a `{name}.txt` file (disabled when
  empty).
- **Upload** loads a local text file into the editor. When the document is
  dirty, it asks for confirmation first, because uploading replaces the editor
  content. Files longer than the content limit are rejected.

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

## Dialogs

- Confirm dialogs are centered, capped at the viewport
  (`max-h-[calc(100vh-3rem)]` with `overflow-y-auto`), and mounted only while
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

### Concurrency tradeoff

Writes are last-write-wins. If two users edit the same document concurrently,
the later `PUT` silently overwrites the earlier one. This keeps the app simple;
there is no conflict detection or merge.
